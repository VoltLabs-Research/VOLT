import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import CompleteTeamClusterDeletionUseCase from '@modules/team-cluster/application/use-cases/CompleteTeamClusterDeletionUseCase';
import ProcessDaemonJobCompletionUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonJobCompletionUseCase';
import ProcessDaemonSceneArtifactUpsertUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import ProcessDaemonTrajectoryImportUseCase from '@modules/team-cluster/application/use-cases/ProcessDaemonTrajectoryImportUseCase';
import RecordTeamClusterHeartbeatUseCase from '@modules/team-cluster/application/use-cases/RecordTeamClusterHeartbeatUseCase';
import UpdateTeamClusterLifecycleUseCase from '@modules/team-cluster/application/use-cases/UpdateTeamClusterLifecycleUseCase';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterRemoteTerminalService from '@modules/team-cluster/infrastructure/services/TeamClusterRemoteTerminalService';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { SocketTeamClusterTerminalClient } from '@modules/team-cluster/socket/SocketTeamClusterTerminalClient';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import {
    getTeamClusterRoom,
    TEAM_CLUSTER_DAEMON_COMMAND,
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
    TEAM_CLUSTER_SUBSCRIPTION_EVENT,
    type TeamClusterDaemonCommandMessage,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRegisterPayload,
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { inject, singleton } from 'tsyringe';
import { z } from 'zod/v4';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import type { ProcessDaemonSceneArtifactUpsertInputDTO } from '@modules/team-cluster/application/use-cases/ProcessDaemonSceneArtifactUpsertUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';

interface SubscribeToTeamClusterSocketPayload {
    teamClusterIds: string[];
};

interface TeamClusterTerminalAttachPayload {
    sessionId: string;
};

const subscribeToTeamClusterSocketPayloadSchema = z.object({
    teamClusterIds: z.array(z.string().trim().min(1))
}).strict();

const teamClusterTerminalAttachPayloadSchema = z.object({
    sessionId: z.string().trim().min(1)
}).strict();

const daemonRegisterPayloadSchema = z.object({
    teamClusterId: z.string().trim().min(1),
    daemonPassword: z.string().trim().min(1)
}).strict();

@singleton()
export default class TeamClusterSocketModule extends BaseSocketModule {
    public readonly name = 'TeamClusterSocketModule';

    constructor(
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry,
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterHeartbeatMonitor)
        private readonly teamClusterHeartbeatMonitor: TeamClusterHeartbeatMonitor,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterLifecycleService)
        private readonly teamClusterLifecycleService: TeamClusterLifecycleService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRemoteTerminalService)
        private readonly teamClusterRemoteTerminalService: TeamClusterRemoteTerminalService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(UpdateTeamClusterLifecycleUseCase)
        private readonly updateTeamClusterLifecycleUseCase: UpdateTeamClusterLifecycleUseCase,

        @inject(RecordTeamClusterHeartbeatUseCase)
        private readonly recordTeamClusterHeartbeatUseCase: RecordTeamClusterHeartbeatUseCase,

        @inject(CompleteTeamClusterDeletionUseCase)
        private readonly completeTeamClusterDeletionUseCase: CompleteTeamClusterDeletionUseCase,

        @inject(ProcessDaemonJobCompletionUseCase)
        private readonly processDaemonJobCompletionUseCase: ProcessDaemonJobCompletionUseCase,

        @inject(ProcessDaemonSceneArtifactUpsertUseCase)
        private readonly processDaemonSceneArtifactUpsertUseCase: ProcessDaemonSceneArtifactUpsertUseCase,

        @inject(ProcessDaemonTrajectoryImportUseCase)
        private readonly processDaemonTrajectoryImportUseCase: ProcessDaemonTrajectoryImportUseCase
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
        if (connection.nativeSocket) {
            const terminalClient = new SocketTeamClusterTerminalClient(connection.nativeSocket);

            connection.nativeSocket.on('team-cluster:terminal:attach', async (payload: TeamClusterTerminalAttachPayload) => {
                const parsed = teamClusterTerminalAttachPayloadSchema.safeParse(payload);
                if (!parsed.success) {
                    terminalClient.emitError({
                        code: ErrorCodes.VALIDATION_INVALID_INPUT,
                        details: formatSocketValidationError(parsed.error)
                    });
                    return;
                }

                await this.teamClusterRemoteTerminalService.attach(terminalClient, {
                    sessionId: parsed.data.sessionId,
                    userId: connection.userId ?? '',
                    teamIds: connection.user?.teams ?? []
                });
            });
        }

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
                }

                conn.data.teamClusterIds = nextSubscribedIds;
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
                    const handled = await this.handleDaemonServerEvent(payload);
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
                    logger.warn({ err: error, teamClusterId }, 'Failed to mark team cluster disconnected after daemon socket close');
                }
            }
        });
    }

    private async handleDaemonServerCommand(socketId: string, payload: TeamClusterDaemonCommandMessage): Promise<void> {
        if (payload.command === TEAM_CLUSTER_DAEMON_COMMAND.runtime.config.get) {
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
                        contractVersion: TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION,
                        queueConcurrency: teamCluster.props.queueConcurrency,
                        roleConfig: teamCluster.props.roleConfig,
                        effectiveCapabilities: teamCluster.props.effectiveCapabilities
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

        if (
            payload.command === 'analysis.job-complete'
            || payload.command === 'analysis.job-status'
            || payload.command === 'trajectory.raster-job-status'
            || payload.command === 'trajectory.glb-job-status'
        ) {
            const result = await this.processDaemonJobCompletionUseCase.execute(payload.payload as never);
            this.emitUseCaseResult(socketId, payload.requestId, result);
            return;
        }

        if (payload.command === 'trajectory.scene-artifact.upsert') {
            const result = await this.processDaemonSceneArtifactUpsertUseCase.execute(payload.payload as never);
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

    private async handleDaemonServerEvent(payload: TeamClusterDaemonMessage): Promise<boolean> {
        if (
            payload.type === 'analysis-job-completion'
            || payload.type === 'analysis-job-status'
            || payload.type === 'trajectory-raster-job-status'
            || payload.type === 'trajectory-glb-job-status'
        ) {
            const result = await this.processDaemonJobCompletionUseCase.execute(payload as never);
            if (!result.success) {
                logger.warn(
                    {
                        type: payload.type,
                        statusCode: result.error.statusCode,
                        message: result.error.message
                    },
                    'Failed to process daemon job event'
                );
            }

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
                logger.warn(
                    {
                        type: payload.type,
                        batchSize: payload.items.length,
                        statusCode: result.error.statusCode,
                        message: result.error.message
                    },
                    'Failed to process daemon scene artifact batch'
                );
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
