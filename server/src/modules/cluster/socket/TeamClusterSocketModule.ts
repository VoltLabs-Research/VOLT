import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import PluginDebugSessionRegistryService from '@modules/plugin/infrastructure/services/PluginDebugSessionRegistryService';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import type TeamCluster from '@modules/cluster/domain/entities/TeamCluster';
import {
    toTeamClusterQueueConcurrencyDTO,
    toTeamClusterQueueScopeLimitsDTO
} from '@modules/cluster/application/dtos/TeamClusterDTO';
import CompleteTeamClusterDeletionUseCase from '@modules/cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import ProcessDaemonJobCompletionUseCase from '@modules/cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import type { ProcessDaemonSceneArtifactUpsertInputDTO } from '@modules/cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonSceneArtifactUpsertUseCase from '@modules/cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import TeamClusterRepository from '@modules/cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterHeartbeatMonitor from '@modules/cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterLifecycleService from '@modules/cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterReverseChannelService, {
    type TeamClusterDaemonInboundStreamPayload
} from '@modules/cluster/infrastructure/services/TeamClusterReverseChannelService';
import {
    TEAM_CLUSTER_METRICS_ALL_EVENT,
    TEAM_CLUSTER_METRICS_HISTORY_EVENT,
    toTeamClusterClientMetrics
} from '@modules/cluster/utilities/teamClusterMetricsSocket';
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
} from '@modules/cluster/utilities/teamClusterSocket';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { Result } from '@shared/domain/port/Result';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

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

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamClusterSocketModule extends BaseSocketModule {
    public readonly name = 'TeamClusterSocketModule';
    private readonly daemonStreamUnsubscribeFns: Array<() => void> = [];
    private readonly pendingDaemonDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        emitter: SocketIOEmitter,
        roomManager: SocketIORoomManager,
        eventRegistry: SocketIOEventRegistry,
        private readonly teamClusterHeartbeatMonitor: TeamClusterHeartbeatMonitor,
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService,
        private readonly teamClusterRepository: TeamClusterRepository,
        private readonly updateTeamClusterLifecycleUseCase: UpdateTeamClusterLifecycleUseCase,
        private readonly recordTeamClusterHeartbeatUseCase: RecordTeamClusterHeartbeatUseCase,
        private readonly completeTeamClusterDeletionUseCase: CompleteTeamClusterDeletionUseCase,
        private readonly processDaemonJobCompletionUseCase: ProcessDaemonJobCompletionUseCase,
        private readonly processDaemonSceneArtifactUpsertUseCase: ProcessDaemonSceneArtifactUpsertUseCase,
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,
        private readonly pluginDebugSessionRegistry: PluginDebugSessionRegistryService,
        private readonly systemMetricsRepository: SystemMetricsRedisRepository
    ) {
        super(emitter, roomManager, eventRegistry);
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
                    const teamCluster = await this.teamClusterRepository.findById(teamClusterId);

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
                const teamCluster = await this.teamClusterRepository.findById(payload.clusterId);
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

    private registerDaemonStreamConsumers(): void {
        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.AnalysisLogChunk,
                (message) => {
                    void this.handleAnalysisLogChunkStream(message);
                }
            )
        );

        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.DebugLogChunk,
                (message) => {
                    void this.handleDebugLogChunkStream(message);
                }
            )
        );

        this.daemonStreamUnsubscribeFns.push(
            this.teamClusterReverseChannelService.registerInboundStreamConsumer(
                TEAM_CLUSTER_DAEMON_STREAM_ID.TrajectorySceneArtifactUpsertBatch,
                (message) => {
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

        const inputs: ProcessDaemonSceneArtifactUpsertInputDTO[] = payload.items.map((item) => ({
            teamClusterId: payload.teamClusterId,
            daemonPassword: payload.daemonPassword,
            trajectory: item.trajectory,
            storageClusterId: item.storageClusterId,
            analysis: item.analysis,
            plugin: item.plugin,
            sourceType: item.sourceType as ProcessDaemonSceneArtifactUpsertInputDTO['sourceType'],
            timestep: item.timestep,
            objectName: item.objectName,
            storageBucket: item.storageBucket,
            params: item.params as ProcessDaemonSceneArtifactUpsertInputDTO['params'],
            displayName: item.displayName,
            status: item.status as ProcessDaemonSceneArtifactUpsertInputDTO['status'],
            metadata: item.metadata
        }));
        const result = await this.processDaemonSceneArtifactUpsertUseCase.executeBatch(inputs);

        if (!result.success) {
            logger.warn(`Failed to process daemon scene artifact batch streamId=${message.streamId} batchSize=${payload.items.length} statusCode=${result.error.statusCode} message=${result.error.message}`);
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

            const teamCluster = await this.teamClusterRepository.findById(teamClusterId);
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
                        queueConcurrency: toTeamClusterQueueConcurrencyDTO(teamCluster.props.queueConcurrency),
                        queueScopeLimits: toTeamClusterQueueScopeLimitsDTO(teamCluster.props.queueScopeLimits),
                        roleConfig: teamCluster.props.roleConfig,
                        effectiveCapabilities: teamCluster.effectiveCapabilities
                    }
                }
            });
            return;
        }

        if (payload.command === 'runtime.heartbeat') {
            const result = await this.recordTeamClusterHeartbeatUseCase.execute(payload.payload as never);
            this.emitUseCaseResult(socketId, payload.requestId, result);
            return;
        }

        if (payload.command === 'runtime.lifecycle') {
            const result = await this.updateTeamClusterLifecycleUseCase.execute(payload.payload as never);
            this.emitUseCaseResult(socketId, payload.requestId, result);
            return;
        }

        if (payload.command === 'runtime.delete-completed') {
            const result = await this.completeTeamClusterDeletionUseCase.execute(payload.payload as never);
            this.emitUseCaseResult(socketId, payload.requestId, result);
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
            const result = await this.processDaemonJobCompletionUseCase.execute(payload as never);
            if (!result.success) {
                logger.warn(`Failed to process daemon job event type=${payload.type} statusCode=${result.error.statusCode} message=${result.error.message}`);
            }

            return true;
        }

        if (payload.type === 'runtime-heartbeat') {
            this.clearPendingDaemonDisconnect(payload.teamClusterId);
            const result = await this.recordTeamClusterHeartbeatUseCase.execute(payload as never);
            if (!result.success) {
                logger.warn(`Failed to record daemon heartbeat teamClusterId=${payload.teamClusterId} statusCode=${result.error.statusCode} message=${result.error.message}`);
            }

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

    private emitUseCaseResult<T>(socketId: string, requestId: string, result: Result<T, ApplicationError>): void {
        if (!result.success) {
            this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
                type: 'response',
                requestId,
                ok: false,
                status: result.error.statusCode,
                message: result.error.message
            });
            return;
        }

        this.emitToSocket(socketId, TEAM_CLUSTER_DAEMON_MESSAGE_EVENT, {
            type: 'response',
            requestId,
            ok: true,
            status: 200,
            data: {
                status: 'success',
                data: result.value
            }
        });
    }
}
