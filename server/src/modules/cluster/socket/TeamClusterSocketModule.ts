import { ErrorCodes } from '@core/constants/error-codes';
import type { ISocketConnection } from '@modules/socket/socket/ISocketModule';
import { socketIOEmitter } from '@modules/socket/services/SocketIOEmitter';
import { socketIOEventRegistry } from '@modules/socket/services/SocketIOEventRegistry';
import { socketIORoomManager } from '@modules/socket/services/SocketIORoomManager';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import { toTeamClusterLike, type TeamCluster } from '@modules/cluster/contracts/team-cluster';
import systemMetricsRepository from '@modules/system/services/SystemMetricsRepository';
import teamClusterHeartbeatMonitor from '@modules/cluster/services/team-cluster/TeamClusterHeartbeatMonitor';
import teamClusterLifecycleService from '@modules/cluster/services/team-cluster/TeamClusterLifecycleService';
import teamClusterReverseChannelService from '@modules/cluster/services/reverse-channel/TeamClusterReverseChannelService';
import TeamClusterDaemonFrameRouter from '@modules/cluster/socket/TeamClusterDaemonFrameRouter';
import {
    TEAM_CLUSTER_DAEMON_MESSAGE_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTERED_EVENT,
    TEAM_CLUSTER_DAEMON_REGISTER_EVENT,
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL,
    TEAM_CLUSTER_METRICS_ALL_EVENT,
    TEAM_CLUSTER_METRICS_HISTORY_EVENT,
    TEAM_CLUSTER_SUBSCRIPTION_EVENT,
    getTeamClusterRoom,
    toTeamClusterClientMetrics,
    type TeamClusterDaemonMessage,
    type TeamClusterDaemonRegisterPayload,
    type TeamClusterDaemonSocketChannel
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
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

const LIFECYCLE_CHANNELS: TeamClusterDaemonSocketChannel[] = [
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control,
    TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Heartbeat
];

class TeamClusterSocketModule extends BaseSocketModule {
    public readonly name = 'TeamClusterSocketModule';
    private readonly daemonStreamUnsubscribeFns: Array<() => void> = [];
    private readonly pendingDaemonDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly daemonFrameRouter = new TeamClusterDaemonFrameRouter(
        (socketId, event, payload) => {
            this.emitToSocket(socketId, event, payload);
        },
        (teamClusterId) => {
            this.clearPendingDaemonDisconnect(teamClusterId);
        }
    );

    constructor() {
        super(socketIOEmitter, socketIORoomManager, socketIOEventRegistry);
    }

    async onInit(): Promise<void> {
        teamClusterHeartbeatMonitor.start();
        this.daemonStreamUnsubscribeFns.push(...this.daemonFrameRouter.registerInboundStreamConsumers());
    }

    async onShutdown(): Promise<void> {
        for (const unsubscribe of this.daemonStreamUnsubscribeFns.splice(0)) {
            unsubscribe();
        }
        for (const timer of this.pendingDaemonDisconnectTimers.values()) {
            clearTimeout(timer);
        }
        this.pendingDaemonDisconnectTimers.clear();
        teamClusterHeartbeatMonitor.stop();
    }

    onConnection(connection: ISocketConnection): void {
        this.on<SubscribeToTeamClusterSocketPayload>(
            connection.id,
            TEAM_CLUSTER_SUBSCRIPTION_EVENT,
            async (conn, payload) => {
                const previousTeamClusterIds = (conn.data.teamClusterIds as string[] | undefined) ?? [];
                const requestedIds = Array.from(new Set(payload.teamClusterIds));
                const nextSubscribedIds: string[] = [];

                for (const previousTeamClusterId of previousTeamClusterIds) {
                    if (!requestedIds.includes(previousTeamClusterId)) {
                        await this.leaveRoom(conn.id, getTeamClusterRoom(previousTeamClusterId));
                    }
                }

                for (const teamClusterId of requestedIds) {
                    const teamCluster = await this.findAuthorizedTeamCluster(conn, teamClusterId, 'You are not allowed to subscribe to this team cluster');
                    if (!teamCluster) {
                        continue;
                    }

                    await this.joinRoom(conn.id, getTeamClusterRoom(teamClusterId));
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
                const teamCluster = await this.findAuthorizedTeamCluster(conn, payload.clusterId, 'You are not allowed to read metrics for this team cluster');
                if (!teamCluster) {
                    return;
                }

                const history = await systemMetricsRepository.getHistoryByClusterId(
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
                await teamClusterLifecycleService.authenticateDaemonConnection(
                    payload.teamClusterId,
                    payload.daemonPassword
                );

                const channel = payload.channel ?? TEAM_CLUSTER_DAEMON_SOCKET_CHANNEL.Control;
                if (LIFECYCLE_CHANNELS.includes(channel)) {
                    this.clearPendingDaemonDisconnect(payload.teamClusterId);
                    await teamClusterLifecycleService.markDaemonConnected(payload.teamClusterId);
                }

                teamClusterReverseChannelService.registerDaemonConnection(conn.id, payload.teamClusterId, channel);
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
                if (teamClusterReverseChannelService.isRegisteredDaemonSocket(connection.id)) {
                    if (payload.type === 'command') {
                        await this.daemonFrameRouter.handleCommand(connection.id, payload);
                        return;
                    }

                    if (await this.daemonFrameRouter.handleEvent(connection.id, payload)) {
                        return;
                    }
                }

                teamClusterReverseChannelService.handleMessage(connection.id, payload);
            }
        );

        this.onDisconnect(connection.id, async (conn) => {
            delete conn.data.teamClusterIds;
            const registration = teamClusterReverseChannelService.unregisterDaemonConnection(connection.id);
            if (registration && LIFECYCLE_CHANNELS.includes(registration.channel)) {
                this.scheduleDaemonDisconnect(registration.teamClusterId, registration.channel);
            }
        });
    }

    private async findAuthorizedTeamCluster(
        conn: ISocketConnection,
        teamClusterId: string,
        forbiddenMessage: string
    ): Promise<TeamCluster | null> {
        const entity = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        const teamCluster = entity ? toTeamClusterLike(entity) : null;

        if (!teamCluster || !new Set(conn.user?.teams ?? []).has(teamCluster.props.team)) {
            this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, forbiddenMessage);
            return null;
        }

        return teamCluster;
    }

    private async emitLatestMetricsToSocket(socketId: string, teamCluster: TeamCluster): Promise<void> {
        const latestMetric = await systemMetricsRepository.getLatestByClusterId(teamCluster.id);
        if (!latestMetric) {
            return;
        }

        this.emitToSocket(socketId, TEAM_CLUSTER_METRICS_ALL_EVENT, [
            toTeamClusterClientMetrics(teamCluster, latestMetric)
        ]);
    }

    private hasLifecycleSocketConnection(teamClusterId: string): boolean {
        return LIFECYCLE_CHANNELS.some((channel) => teamClusterReverseChannelService.hasDaemonConnection(teamClusterId, channel));
    }

    private clearPendingDaemonDisconnect(teamClusterId: string): void {
        const timer = this.pendingDaemonDisconnectTimers.get(teamClusterId);
        if (!timer) {
            return;
        }

        clearTimeout(timer);
        this.pendingDaemonDisconnectTimers.delete(teamClusterId);
    }

    private scheduleDaemonDisconnect(teamClusterId: string, channel: TeamClusterDaemonSocketChannel): void {
        this.clearPendingDaemonDisconnect(teamClusterId);

        if (this.hasLifecycleSocketConnection(teamClusterId)) {
            return;
        }

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
            await teamClusterLifecycleService.markDaemonDisconnected(teamClusterId);
        } catch {
            logger.warn(`Failed to mark team cluster disconnected after daemon socket close teamClusterId=${teamClusterId}`);
        }
    }
}

export default new TeamClusterSocketModule();
