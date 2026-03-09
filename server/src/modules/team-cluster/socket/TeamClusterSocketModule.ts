import { ErrorCodes } from '@core/constants/error-codes';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterHeartbeatMonitor from '@modules/team-cluster/infrastructure/services/TeamClusterHeartbeatMonitor';
import TeamClusterLifecycleService from '@modules/team-cluster/infrastructure/services/TeamClusterLifecycleService';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { formatSocketValidationError } from '@modules/socket/utilities/socket-validation-error';
import {
    getTeamClusterRoom,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_RESPONSE_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_END_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_STREAM_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_END_EVENT,
    TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACHED_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_END_EVENT,
    TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT,
    TEAM_CLUSTER_SUBSCRIPTION_EVENT,
    type TeamClusterDaemonRegisterPayload,
    type TeamClusterDaemonSocketResponsePayload,
    type TeamClusterDaemonSocketStreamPayload,
    type TeamClusterDaemonSocketStreamStatePayload,
    type TeamClusterDaemonTerminalDataPayload,
    type TeamClusterDaemonTerminalDetachPayload,
    type TeamClusterDaemonTerminalStatePayload,
    type TeamClusterDaemonWebSocketDataPayload,
    type TeamClusterDaemonWebSocketDetachPayload,
    type TeamClusterDaemonWebSocketStatePayload
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { inject, singleton } from 'tsyringe';
import { z } from 'zod/v4';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

interface SubscribeToTeamClusterSocketPayload {
    teamClusterIds: string[];
};

const subscribeToTeamClusterSocketPayloadSchema = z.object({
    teamClusterIds: z.array(z.string().trim().min(1))
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

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
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

                this.teamClusterReverseChannelService.registerDaemonConnection(conn.id, parsed.data.teamClusterId);
                this.emitToSocket(conn.id, TEAM_CLUSTER_DAEMON_REGISTERED_EVENT, {
                    teamClusterId: parsed.data.teamClusterId
                });
            }
        );

        this.on<TeamClusterDaemonSocketResponsePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_RESPONSE_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleResponse(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonSocketStreamPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_STREAM_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleStreamChunk(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonSocketStreamStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_STREAM_END_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleStreamEnd(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonSocketStreamStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_STREAM_ERROR_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleStreamError(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonTerminalDetachPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_TERMINAL_ATTACHED_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleTerminalAttached(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonTerminalDataPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_TERMINAL_DATA_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleTerminalData(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonTerminalStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_TERMINAL_END_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleTerminalEnd(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonTerminalStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_TERMINAL_ERROR_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleTerminalError(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonWebSocketDetachPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_WEBSOCKET_ATTACHED_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleWebSocketAttached(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonWebSocketDataPayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_WEBSOCKET_DATA_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleWebSocketData(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonWebSocketStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_WEBSOCKET_END_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleWebSocketEnd(connection.id, payload);
            }
        );

        this.on<TeamClusterDaemonWebSocketStatePayload>(
            connection.id,
            TEAM_CLUSTER_DAEMON_WEBSOCKET_ERROR_EVENT,
            async (_conn, payload) => {
                this.teamClusterReverseChannelService.handleWebSocketError(connection.id, payload);
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            delete conn.data.teamClusterIds;
            this.teamClusterReverseChannelService.unregisterDaemonConnection(connection.id);
        });
    }
};
