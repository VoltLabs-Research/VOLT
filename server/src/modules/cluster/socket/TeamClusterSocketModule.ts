import { ErrorCodes } from '@core/constants/error-codes';
import analysisExecutionLogServiceInstance from '@modules/analysis/services/AnalysisExecutionLogService';
import pluginDebugSessionRegistrySingleton from '@modules/plugin/services/PluginDebugSessionRegistryService';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/domain/team-cluster';
import {
    toTeamClusterQueueConcurrencyView,
    toTeamClusterQueueScopeLimitsView
} from '@modules/cluster/services/TeamClusterView';
import ClusterService, {
    type ProcessDaemonSceneArtifactUpsertInput
} from '@modules/cluster/services/ClusterService';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRedisRepository';
import teamClusterHeartbeatMonitor from '@modules/cluster/services/TeamClusterHeartbeatMonitor';
import teamClusterLifecycleService from '@modules/cluster/services/TeamClusterLifecycleService';
import teamClusterReverseChannelService from '@modules/cluster/services/TeamClusterReverseChannelService';
import type { TeamClusterDaemonInboundStreamPayload } from '@modules/cluster/services/TeamClusterReverseChannelTypes';
import { ProvenanceService } from '@modules/analysis/services/ProvenanceService';
import {
    TEAM_CLUSTER_METRICS_ALL_EVENT,
    TEAM_CLUSTER_METRICS_HISTORY_EVENT,
    toTeamClusterClientMetrics
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ID,
    TEAM_CLUSTER_SUBSCRIPTION_EVENT,
    getTeamClusterRoom,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRegisterPayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import type { TeamClusterDaemonExecutionLogSegment } from '@modules/cluster/socket/TeamClusterSocketProtocol';

interface DaemonAppendFrameSegmentsService {
    appendFrameSegments(input: {
        analysisId: string;
        teamId: string;
        trajectoryId: string;
        jobId: string;
        timestep: number;
        segments: TeamClusterDaemonExecutionLogSegment[];
    }): Promise<void>;
}

interface SubscribeToTeamClusterSocketPayload {
    teamClusterIds: string[];
}

interface ClusterMetricsHistorySocketPayload {
    clusterId: string;
    minutes?: number;
}

const TEAM_CLUSTER_DAEMON_DISCONNECT_GRACE_MS = readPositiveIntegerEnv(
    'TEAM_CLUSTER_DAEMON_DISCONNECT_GRACE_MS',
    60_000
);

interface DaemonStreamLogSegment {
    stream: 'stdout' | 'stderr' | 'system';
    text: string;
    occurredAt: string;
    nodeId?: string;
    nodeType?: string;
    nodeLabel?: string;
    pluginId?: string;
    executionPath?: string[];
}

interface DaemonAnalysisLogChunkStreamPayload {
    type: string;
    teamClusterId: string;
    daemonPassword: string;
    jobId: string;
    analysisId: string;
    teamId: string;
    trajectoryId: string;
    timestep: number;
    segments: DaemonStreamLogSegment[];
}

interface DaemonDebugLogChunkStreamPayload {
    type: string;
    teamClusterId: string;
    daemonPassword: string;
    sessionId: string;
    nodeId: string;
    segments: DaemonStreamLogSegment[];
}

interface DaemonSceneArtifactUpsertItem {
    trajectory: string;
    storageClusterId: string;
    analysis?: string;
    plugin?: string;
    sourceType: 'color-coding' | 'particle-filter' | 'plugin-exposure';
    timestep: number;
    objectName: string;
    storageBucket: string;
    params: Record<string, unknown>;
    displayName: string;
    status: 'ready' | 'failed';
    metadata?: Record<string, unknown>;
}

interface DaemonSceneArtifactUpsertBatchStreamPayload {
    type: string;
    teamClusterId: string;
    daemonPassword: string;
    items: DaemonSceneArtifactUpsertItem[];
}

class TeamClusterSocketModule extends BaseSocketModule {
    public readonly name = 'TeamClusterSocketModule';
    private readonly daemonStreamUnsubscribeFns: Array<() => void> = [];
    private readonly pendingDaemonDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

    #clusterServiceCache?: ClusterService;
    private get clusterService(): ClusterService {
        return (this.#clusterServiceCache ??= new ClusterService());
    }

    private readonly teamClusterHeartbeatMonitor = teamClusterHeartbeatMonitor;
    private readonly teamClusterLifecycleService = teamClusterLifecycleService;
    private readonly teamClusterReverseChannelService = teamClusterReverseChannelService;
    private readonly analysisExecutionLogService: DaemonAppendFrameSegmentsService = analysisExecutionLogServiceInstance;
    private readonly pluginDebugSessionRegistry = pluginDebugSessionRegistrySingleton;
    private readonly systemMetricsRepository = systemMetricsRepository;
    private readonly provenanceService = new ProvenanceService();

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    async onInit(): Promise<void> {
        this.teamClusterHeartbeatMonitor.start();
        this.registerDaemonStreamConsumers();
    }

    async onShutdown(): Promise<void> {
        for (const unsubscribe of this.daemonStreamUnsubscribeFns.splice(0)) {
            unsubscribe();
        }
        for (const timer of this.pendingDaemonDisconnectTimers.values()) {
            clearTimeout(timer);
        }
        this.pendingDaemonDisconnectTimers.clear();
        this.teamClusterHeartbeatMonitor.stop();
    }

    onConnection(connection: ISocketConnection): void {
        this.on<SubscribeToTeamClusterSocketPayload>(
            connection.id,
            TEAM_CLUSTER_SUBSCRIPTION_EVENT,
            async (conn, payload) => {
                const previousTeamClusterIds = Array.isArray(conn.data.teamClusterIds)
                    ? conn.data.teamClusterIds.filter((value): value is string => typeof value === 'string')
                    : [];
                const requestedIds = Array.from(new Set(payload.teamClusterIds));
                const authorizedTeamIds = new Set(conn.user?.teams ?? []);
                const nextSubscribedIds: string[] = [];

                for (const previousTeamClusterId of previousTeamClusterIds) {
                    if (!requestedIds.includes(previousTeamClusterId)) {
                        await this.leaveRoom(conn.id, getTeamClusterRoom(previousTeamClusterId));
                    }
                }

                for (const teamClusterId of requestedIds) {
                    const teamCluster = await this.findTeamClusterById(teamClusterId);

                    if (!teamCluster || !authorizedTeamIds.has(teamCluster.props.team)) {
                        this.emitErrorToSocket(
                            conn.id,
                            ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                            'You are not allowed to subscribe to this team cluster'
                        );
                        continue;
                    }

                    const roomName = getTeamClusterRoom(teamClusterId);
                    await this.joinRoom(conn.id, roomName);
                    nextSubscribedIds.push(teamClusterId);
                    await this.emitLatestMetricsToSocket(conn.id, teamCluster);
                }

                conn.data.teamClusterIds = nextSubscribedIds;
            }
        );

        this.on<ClusterMetricsHistorySocketPayload>(
            connection.id,
            TEAM_CLUSTER_METRICS_HISTORY_EVENT,
            async (conn, payload) => {
                const teamCluster = await this.findTeamClusterById(payload.clusterId);
                const authorizedTeamIds = new Set(conn.user?.teams ?? []);

                if (!teamCluster || !authorizedTeamIds.has(teamCluster.props.team)) {
                    this.emitErrorToSocket(
                        conn.id,
                        ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN,
                        'You are not allowed to read metrics for this team cluster'
                    );
                    return;
                }

                const history = await this.systemMetricsRepository.getHistoryByClusterId(
                    teamCluster.id,
                    payload.minutes ?? 5
                );
                const mappedHistory = history.map((metric) => toTeamClusterClientMetrics(teamCluster, metric));

                this.emitToSocket(conn.id, TEAM_CLUSTER_METRICS_HISTORY_EVENT, {
                    clusterId: teamCluster.id,
                    history: mappedHistory
                });

                const latestMetric = mappedHistory[mappedHistory.length - 1];
                if (latestMetric) {
                    this.emitToSocket(conn.id, TEAM_CLUSTER_METRICS_ALL_EVENT, [latestMetric]);
                }
            }
        );

        this.on<TeamClusterDaemonRegisterPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
            async (conn, payload) => {
                await this.teamClusterLifecycleService.authenticateDaemonConnection(
                    payload.teamClusterId,
                    payload.daemonPassword
                );

                const channel = payload.channel ?? TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control;
                if (
                    channel === TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control
                    || channel === TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Heartbeat
                ) {
                    this.clearPendingDaemonDisconnect(payload.teamClusterId);
                    await this.teamClusterLifecycleService.markDaemonConnected(payload.teamClusterId);
                }

                this.teamClusterReverseChannelService.registerDaemonConnection(
                    conn.id,
                    payload.teamClusterId,
                    channel
                );
                this.emitToSocket(conn.id, TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, {
                    teamClusterId: payload.teamClusterId,
                    channel
                });
            }
        );

        this.on<TeamClusterDaemonMessage>(
            connection.id,
            TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
            async (_conn, payload) => {
                if (this.teamClusterReverseChannelService.isRegisteredDaemonSocket(connection.id) && payload.type === 'command') {
                    await this.handleDaemonServerCommand(connection.id, payload);
                    return;
                }

                if (this.teamClusterReverseChannelService.isRegisteredDaemonSocket(connection.id)) {
                    const handled = await this.handleDaemonServerEvent(connection.id, payload);
                    if (handled) {
                        return;
                    }
                }

                this.teamClusterReverseChannelService.handleMessage(connection.id, payload);
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            delete conn.data.teamClusterIds;
            const registration = this.teamClusterReverseChannelService.unregisterDaemonConnection(connection.id);
            if (registration && this.isLifecycleSocketChannel(registration.channel)) {
                this.scheduleDaemonDisconnect(registration.teamClusterId, registration.channel);
            }
        });
    }

    private async findTeamClusterById(teamClusterId: string): Promise<TeamCluster | null> {
        const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        return entity ? toTeamClusterLike(entity) : null;
    }

    private registerDaemonStreamConsumers(): void {
        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.AnalysisLogChunk,
                (message: TeamClusterDaemonInboundStreamPayload) => {
                    void this.handleAnalysisLogChunkStream(message);
                }
            )
        );

        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.DebugLogChunk,
                (message: TeamClusterDaemonInboundStreamPayload) => {
                    void this.handleDebugLogChunkStream(message);
                }
            )
        );

        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.TrajectorySceneArtifactUpsertBatch,
                (message: TeamClusterDaemonInboundStreamPayload) => {
                    void this.handleSceneArtifactUpsertBatchStream(message);
                }
            )
        );
    }

    private async handleAnalysisLogChunkStream(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.parseInboundStreamPayload<DaemonAnalysisLogChunkStreamPayload>(message);
        if (!payload) {
            return;
        }

        await this.analysisExecutionLogService.appendFrameSegments({
            analysisId: payload.analysisId,
            teamId: payload.teamId,
            trajectoryId: payload.trajectoryId,
            jobId: payload.jobId,
            timestep: payload.timestep,
            segments: payload.segments
        });
    }

    private async handleDebugLogChunkStream(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.parseInboundStreamPayload<DaemonDebugLogChunkStreamPayload>(message);
        if (!payload) {
            return;
        }

        this.pluginDebugSessionRegistry.emitLogChunk(
            payload.sessionId,
            payload.teamClusterId,
            payload.nodeId,
            payload.segments
        );
    }

    private async handleSceneArtifactUpsertBatchStream(message: TeamClusterDaemonInboundStreamPayload): Promise<void> {
        const payload = this.parseInboundStreamPayload<DaemonSceneArtifactUpsertBatchStreamPayload>(message);
        if (!payload) {
            return;
        }

        const inputs: ProcessDaemonSceneArtifactUpsertInput[] = payload.items.map((item) => ({
            teamClusterId: payload.teamClusterId,
            daemonPassword: payload.daemonPassword,
            trajectory: item.trajectory,
            storageClusterId: item.storageClusterId,
            analysis: item.analysis,
            plugin: item.plugin,
            sourceType: item.sourceType as ProcessDaemonSceneArtifactUpsertInput['sourceType'],
            timestep: item.timestep,
            objectName: item.objectName,
            storageBucket: item.storageBucket,
            params: item.params as ProcessDaemonSceneArtifactUpsertInput['params'],
            displayName: item.displayName,
            status: item.status as ProcessDaemonSceneArtifactUpsertInput['status'],
            metadata: item.metadata
        }));
        try {
            await this.clusterService.processDaemonSceneArtifactUpsertBatch(inputs);
        } catch (error: unknown) {
            const appError = error as ApplicationError;
            logger.warn(`Failed to process daemon scene artifact batch streamId=${message.streamId} batchSize=${payload.items.length} statusCode=${appError.statusCode} message=${appError.message}`);
        }
    }

    private parseInboundStreamPayload<TPayload extends {
        type: string;
        teamClusterId: string;
    }>(
        message: TeamClusterDaemonInboundStreamPayload
    ): TPayload | null {
        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(message.chunk.toString('utf8'));
        } catch (error) {
            logger.warn(
                error,
                `Failed to parse daemon stream chunk JSON streamId=${message.streamId} requestId=${message.requestId}`
            );
            return null;
        }

        const payload = parsedJson as TPayload;

        if (payload.teamClusterId !== message.teamClusterId) {
            logger.warn(
                `Ignoring daemon stream payload with mismatched cluster streamId=${message.streamId} socketClusterId=${message.teamClusterId} payloadClusterId=${payload.teamClusterId}`
            );
            return null;
        }

        return payload;
    }

    private async emitLatestMetricsToSocket(socketId: string, teamCluster: TeamCluster): Promise<void> {
        const latestMetric = await this.systemMetricsRepository.getLatestByClusterId(teamCluster.id);
        if (!latestMetric) {
            return;
        }

        this.emitToSocket(socketId, TEAM_CLUSTER_METRICS_ALL_EVENT, [
            toTeamClusterClientMetrics(teamCluster, latestMetric)
        ]);
    }

    private async handleDaemonServerCommand(socketId: string, payload: TeamClusterDaemonCommandMessage): Promise<void> {
        if (payload.command === ChannelCommands.RuntimeConfigGet) {
            const teamClusterId = this.teamClusterReverseChannelService.getRegisteredTeamClusterId(socketId);

            if (!teamClusterId) {
                this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
                    type: 'response',
                    requestId: payload.requestId,
                    ok: false,
                    status: 401,
                    message: 'Daemon socket is not registered'
                });
                return;
            }

            const teamCluster = await this.findTeamClusterById(teamClusterId);
            if (!teamCluster) {
                this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
                    type: 'response',
                    requestId: payload.requestId,
                    ok: false,
                    status: 404,
                    message: 'Team cluster not found'
                });
                return;
            }

            this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
                type: 'response',
                requestId: payload.requestId,
                ok: true,
                status: 200,
                data: {
                    status: 'success',
                    data: {
                        queueConcurrency: toTeamClusterQueueConcurrencyView(teamCluster.props.queueConcurrency),
                        queueScopeLimits: toTeamClusterQueueScopeLimitsView(teamCluster.props.queueScopeLimits),
                        roleConfig: teamCluster.props.roleConfig,
                        effectiveCapabilities: teamCluster.effectiveCapabilities
                    }
                }
            });
            return;
        }

        if (payload.command === 'runtime.heartbeat') {
            try {
                const value = await this.clusterService.recordHeartbeat(payload.payload as never);
                this.emitUseCaseSuccess(socketId, payload.requestId, value);
            } catch (error: unknown) {
                this.emitUseCaseError(socketId, payload.requestId, error as ApplicationError);
            }
            return;
        }

        if (payload.command === 'runtime.lifecycle') {
            try {
                const value = await this.clusterService.updateLifecycle(payload.payload as never);
                this.emitUseCaseSuccess(socketId, payload.requestId, value);
            } catch (error: unknown) {
                this.emitUseCaseError(socketId, payload.requestId, error as ApplicationError);
            }
            return;
        }

        if (payload.command === 'runtime.delete-completed') {
            try {
                const value = await this.clusterService.completeDeletion(payload.payload as never);
                this.emitUseCaseSuccess(socketId, payload.requestId, value);
            } catch (error: unknown) {
                this.emitUseCaseError(socketId, payload.requestId, error as ApplicationError);
            }
            return;
        }

        this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'response',
            requestId: payload.requestId,
            ok: false,
            status: 404,
            message: `Unknown daemon server command: ${payload.command}`
        });
    }

    private async handleDaemonServerEvent(socketId: string, payload: TeamClusterDaemonMessage): Promise<boolean> {
        const registeredTeamClusterId = this.teamClusterReverseChannelService.getRegisteredTeamClusterId(socketId);

        if ('teamClusterId' in payload && registeredTeamClusterId && payload.teamClusterId !== registeredTeamClusterId) {
            logger.warn(`Ignoring daemon server event with mismatched team cluster id registeredTeamClusterId=${registeredTeamClusterId} payloadTeamClusterId=${payload.teamClusterId} type=${payload.type}`);
            return true;
        }

        if (
            payload.type === 'analysis-job-completion'
            || payload.type === 'analysis-job-status'
            || payload.type === 'analysis-stage-status'
            || payload.type === 'trajectory-raster-job-status'
            || payload.type === 'trajectory-glb-job-status'
            || payload.type === 'artifact-upload-job-status'
        ) {
            try {
                await this.clusterService.processDaemonJobCompletion(payload as never);
            } catch (error: unknown) {
                const appError = error as ApplicationError;
                logger.warn(`Failed to process daemon job event type=${payload.type} statusCode=${appError.statusCode} message=${appError.message}`);
            }

            return true;
        }

        if (payload.type === 'runtime-heartbeat') {
            this.clearPendingDaemonDisconnect(payload.teamClusterId);
            try {
                await this.clusterService.recordHeartbeat(payload as never);
            } catch (error: unknown) {
                const appError = error as ApplicationError;
                logger.warn(`Failed to record daemon heartbeat teamClusterId=${payload.teamClusterId} statusCode=${appError.statusCode} message=${appError.message}`);
            }

            return true;
        }

        if ((payload as { type: string }).type === 'analysis-provenance') {
            const prov = payload as unknown as {
                pluginName: string; pluginVersion: string; parameters: Record<string, unknown>;
                inputFrameContentHash: string; atomCount: number; frameIndex: number;
                trajectoryId: string; analysisId: string; teamId: string;
                coreToolkitVersion: string; rngSeed?: number; executedAt: string;
                executedBy: string; executionTimeMs: number; outputArtifactIds: string[];
            };
            this.provenanceService.recordAnalysisExecution({
                ...prov,
                executedAt: new Date(prov.executedAt)
            }).catch((err: unknown) => {
                logger.warn({ err }, 'Failed to record analysis provenance from daemon event');
            });
            return true;
        }

        return false;
    }

    private isLifecycleSocketChannel(channel: string): boolean {
        return channel === TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control
            || channel === TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Heartbeat;
    }

    private hasLifecycleSocketConnection(teamClusterId: string): boolean {
        return this.teamClusterReverseChannelService.hasDaemonConnection(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control
        ) || this.teamClusterReverseChannelService.hasDaemonConnection(
            teamClusterId,
            TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Heartbeat
        );
    }

    private clearPendingDaemonDisconnect(teamClusterId: string): void {
        const timer = this.pendingDaemonDisconnectTimers.get(teamClusterId);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.pendingDaemonDisconnectTimers.delete(teamClusterId);
    }

    private scheduleDaemonDisconnect(teamClusterId: string, channel: string): void {
        if (this.hasLifecycleSocketConnection(teamClusterId)) {
            this.clearPendingDaemonDisconnect(teamClusterId);
            return;
        }

        this.clearPendingDaemonDisconnect(teamClusterId);

        if (TEAM_CLUSTER_DAEMON_DISCONNECT_GRACE_MS <= 0) {
            void this.finalizeDaemonDisconnect(teamClusterId);
            return;
        }

        const timer = setTimeout(() => {
            this.pendingDaemonDisconnectTimers.delete(teamClusterId);
            void this.finalizeDaemonDisconnect(teamClusterId);
        }, TEAM_CLUSTER_DAEMON_DISCONNECT_GRACE_MS);
        timer.unref();
        this.pendingDaemonDisconnectTimers.set(teamClusterId, timer);

        logger.warn(
            `Scheduling team cluster disconnect after daemon ${channel} socket close teamClusterId=${teamClusterId} graceMs=${TEAM_CLUSTER_DAEMON_DISCONNECT_GRACE_MS}`
        );
    }

    private async finalizeDaemonDisconnect(teamClusterId: string): Promise<void> {
        if (this.hasLifecycleSocketConnection(teamClusterId)) {
            return;
        }

        try {
            await this.teamClusterLifecycleService.markDaemonDisconnected(teamClusterId);
        } catch {
            logger.warn(`Failed to mark team cluster disconnected after daemon socket close teamClusterId=${teamClusterId}`);
        }
    }

    private emitUseCaseSuccess<T>(socketId: string, requestId: string, data: T): void {
        this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'response',
            requestId,
            ok: true,
            status: 200,
            data: {
                status: 'success',
                data
            }
        });
    }

    private emitUseCaseError(socketId: string, requestId: string, error: ApplicationError): void {
        this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'response',
            requestId,
            ok: false,
            status: error.statusCode,
            message: error.message
        });
    }
}

export default new TeamClusterSocketModule();
