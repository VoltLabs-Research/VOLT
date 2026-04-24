import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import PluginDebugSessionRegistryService from '@modules/plugin/infrastructure/services/PluginDebugSessionRegistryService';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import SocketIOEmitter from '@modules/socket/infrastructure/services/SocketIOEmitter';
import SocketIOEventRegistry from '@modules/socket/infrastructure/services/SocketIOEventRegistry';
import SocketIORoomManager from '@modules/socket/infrastructure/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import type TeamCluster from '@modules/team-cluster/domain/entities/TeamCluster';
import CompleteTeamClusterDeletionUseCase from '@modules/team-cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import type { ProcessDaemonSceneArtifactUpsertInputDTO } from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonSceneArtifactUpsertUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonTrajectoryImportUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonTrajectoryImportUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/team-cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import {
    TEAM_CLUSTER_METRICS_ALL_EVENT,
    TEAM_CLUSTER_METRICS_HISTORY_EVENT,
    toTeamClusterClientMetrics
} from '@modules/team-cluster/utilities/teamClusterMetricsSocket';
import {
    ChannelCommands,
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_SUBSCRIPTION_EVENT,
    getTeamClusterRoom,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRegisterPayload,
} from '@modules/team-cluster/utilities/teamClusterSocket';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { Result } from '@shared/domain/port/Result';
import { AliasOf, Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { z } from 'zod/v4';

interface SubscribeToTeamClusterSocketPayload {
    teamClusterIds: string[];
};

interface ClusterMetricsHistorySocketPayload {
    clusterId: string;
    minutes?: number;
};

const MAX_CLUSTER_METRICS_HISTORY_MINUTES = 60;

const subscribeToTeamClusterSocketPayloadSchema = z.object({
    teamClusterIds: z.array(z.string().trim().min(1))
}).strict();

const clusterMetricsHistorySocketPayloadSchema = z.object({
    clusterId: z.string().trim().min(1),
    minutes: z.number().int().min(1).max(MAX_CLUSTER_METRICS_HISTORY_MINUTES).optional()
}).strict();

const daemonRegisterPayloadSchema = z.object({
    teamClusterId: z.string().trim().min(1),
    daemonPassword: z.string().trim().min(1)
}).strict();

@Singleton()
@AliasOf(SOCKET_TOKENS.SocketModule)
export default class TeamClusterSocketModule extends BaseSocketModule {
    public readonly name = 'TeamClusterSocketModule';

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

        
        private readonly processDaemonTrajectoryImportUseCase: ProcessDaemonTrajectoryImportUseCase,

        
        private readonly analysisExecutionLogService: AnalysisExecutionLogService,

        
        private readonly pluginDebugSessionRegistry: PluginDebugSessionRegistryService,

        
        private readonly systemMetricsRepository: SystemMetricsRedisRepository
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        this.teamClusterHeartbeatMonitor.start();
    }

    async onShutdown(): Promise<void> {
        this.teamClusterHeartbeatMonitor.stop();
    }

    onConnection(connection: ISocketConnection): void {
        this.on<SubscribeToTeamClusterSocketPayload>(
            connection.id,
            TEAM_CLUSTER_SUBSCRIPTION_EVENT,
            async (conn, payload) => {
                const parsed = subscribeToTeamClusterSocketPayloadSchema.safeParse(payload);

                if (!parsed.success) {
                    this.emitErrorToSocket(
                        conn.id,
                        ErrorCodes.VALIDATION_INVALID_INPUT,
                        formatSocketValidationError(parsed.error)
                    );
                    return;
                }

                const previousTeamClusterIds = Array.isArray(conn.data.teamClusterIds)
                    ? conn.data.teamClusterIds.filter((value): value is string => typeof value === 'string')
                    : [];
                const requestedIds = Array.from(new Set(parsed.data.teamClusterIds));
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
                const parsed = clusterMetricsHistorySocketPayloadSchema.safeParse(payload);

                if (!parsed.success) {
                    this.emitErrorToSocket(
                        conn.id,
                        ErrorCodes.VALIDATION_INVALID_INPUT,
                        formatSocketValidationError(parsed.error)
                    );
                    return;
                }

                const teamCluster = await this.teamClusterRepository.findById(parsed.data.clusterId);
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
                    parsed.data.minutes ?? 5
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
                const parsed = daemonRegisterPayloadSchema.safeParse(payload);

                if (!parsed.success) {
                    this.emitErrorToSocket(
                        conn.id,
                        ErrorCodes.VALIDATION_INVALID_INPUT,
                        formatSocketValidationError(parsed.error)
                    );
                    return;
                }

                await this.teamClusterLifecycleService.authenticateDaemonConnection(
                    parsed.data.teamClusterId,
                    parsed.data.daemonPassword
                );

                await this.teamClusterLifecycleService.markDaemonConnected(parsed.data.teamClusterId);
                this.teamClusterReverseChannelService.registerDaemonConnection(conn.id, parsed.data.teamClusterId);
                this.emitToSocket(conn.id, TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, {
                    teamClusterId: parsed.data.teamClusterId
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
            const teamClusterId = this.teamClusterReverseChannelService.unregisterDaemonConnection(connection.id);
            if (teamClusterId) {
                try {
                    await this.teamClusterLifecycleService.markDaemonDisconnected(teamClusterId);
                } catch (error: unknown) {
                    logger.warn(`Failed to mark team cluster disconnected after daemon socket close teamClusterId=${teamClusterId}`);
                }
            }
        });
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
                        queueConcurrency: teamCluster.props.queueConcurrency,
                        queueScopeLimits: teamCluster.props.queueScopeLimits,
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

        if (payload.command === 'trajectory.import-complete') {
            const result = await this.processDaemonTrajectoryImportUseCase.execute(payload.payload as never);
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
            || payload.type === 'trajectory-raster-job-status'
            || payload.type === 'trajectory-glb-job-status'
            || payload.type === 'ssh-import-job-status'
            || payload.type === 'artifact-upload-job-status'
        ) {
            const result = await this.processDaemonJobCompletionUseCase.execute(payload as never);
            if (!result.success) {
                logger.warn(`Failed to process daemon job event type=${payload.type} statusCode=${result.error.statusCode} message=${result.error.message}`);
            }

            return true;
        }

        if (payload.type === 'analysis-log-chunk') {
            await this.analysisExecutionLogService.appendFrameSegments({
                analysisId: payload.analysisId,
                teamId: payload.teamId,
                trajectoryId: payload.trajectoryId,
                jobId: payload.jobId,
                timestep: payload.timestep,
                segments: payload.segments
            });

            return true;
        }

        if (payload.type === 'debug-log-chunk') {
            this.pluginDebugSessionRegistry.emitLogChunk(
                payload.sessionId,
                payload.teamClusterId,
                payload.nodeId,
                payload.segments
            );

            return true;
        }

        if (payload.type === 'trajectory-scene-artifact-upsert-batch') {
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
                logger.warn(`Failed to process daemon scene artifact batch type=${payload.type} batchSize=${payload.items.length} statusCode=${result.error.statusCode} message=${result.error.message}`);
            }

            return true;
        }

        return false;
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
};
