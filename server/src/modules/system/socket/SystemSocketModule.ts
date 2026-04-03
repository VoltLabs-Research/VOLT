import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import BaseSocketModule from '@modules/socket/socket/BaseSocketModule';
import SocketTeamSubscriptionCoordinator from '@modules/socket/socket/team-subscription/SocketTeamSubscriptionCoordinator';
import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import logger from '@shared/infrastructure/logger';
import { inject, singleton } from 'tsyringe';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';
import type { ISocketConnection } from '@modules/socket/domain/port/ISocketModule';
import type { ISocketRoomManager } from '@modules/socket/domain/port/ISocketRoomManager';
import type { ISocketEventRegistry } from '@modules/socket/domain/port/ISocketEventRegistry';
import type { ClusterSystemMetrics, SystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import SystemMetricsSocketOrchestrator from '@modules/system/socket/SystemMetricsSocketOrchestrator';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';

interface MetricsHistoryPayload {
    minutes?: number;
    clusterId?: string;
};

interface MetricsHistoryResponse {
    clusterId: string;
    history: SystemMetrics[];
};

const TEAM_CLUSTER_TEAM_CACHE_TTL_MS = 30_000;

@singleton()
export default class SystemSocketModule extends BaseSocketModule {
    public readonly name = 'SystemSocketModule';
    private initialized = false;
    private unsubscribeFromTeamSubscription?: () => void;
    private latestMetricsByTeamId = new Map<string, ClusterSystemMetrics[]>();
    private readonly teamIdByClusterIdCache = new Map<string, {
        expiresAt: number;
        teamId: string;
    }>();

    constructor(
        @inject(SYSTEM_TOKENS.MetricsSocketOrchestrator)
        private readonly metricsOrchestrator: SystemMetricsSocketOrchestrator,
        @inject(SOCKET_TOKENS.TeamSubscriptionCoordinator)
        private readonly teamSubscriptionCoordinator: SocketTeamSubscriptionCoordinator,
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository,
        @inject(SOCKET_TOKENS.SocketEventEmitter) emitter: ISocketEmitter,
        @inject(SOCKET_TOKENS.SocketRoomManager) roomManager: ISocketRoomManager,
        @inject(SOCKET_TOKENS.SocketEventRegistry) eventRegistry: ISocketEventRegistry
    ) {
        super(emitter, roomManager, eventRegistry);
    }

    async onInit(): Promise<void> {
        if (this.initialized) {
            return;
        }

        logger.info('[SystemSocketModule] Starting initialization...');
        this.unsubscribeFromTeamSubscription = this.teamSubscriptionCoordinator.subscribe(async ({ connection, subscription }) => {
            this.emitToSocket(connection.id, 'metrics:all', this.latestMetricsByTeamId.get(subscription.teamId) ?? []);
        });
        await this.metricsOrchestrator.start(async (allMetrics) => {
            await this.broadcastTeamMetrics(allMetrics);
        });
        this.initialized = true;
    }

    onConnection(connection: ISocketConnection): void {
        this.on(connection.id, 'metrics:history', async (conn, payload: number | MetricsHistoryPayload = 5) => {
            if (!conn.user?._id) {
                this.emitErrorToSocket(conn.id, ErrorCodes.AUTHENTICATION_REQUIRED, ErrorCodes.AUTHENTICATION_REQUIRED);
                return;
            }

            const currentTeamId = this.teamSubscriptionCoordinator.getCurrentTeamId(conn);
            if (!currentTeamId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_ID_REQUIRED, ErrorCodes.TEAM_ID_REQUIRED);
                return;
            }

            const historyRequest = typeof payload === 'number'
                ? { minutes: payload }
                : payload;

            if (!historyRequest.clusterId) {
                this.emitErrorToSocket(conn.id, ErrorCodes.VALIDATION_INVALID_INPUT, 'Cluster id is required');
                return;
            }

            const teamCluster = await this.teamClusterRepository.findOne({
                _id: historyRequest.clusterId,
                team: currentTeamId
            });

            if (!teamCluster) {
                this.emitErrorToSocket(conn.id, ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 'You do not have access to this cluster history');
                return;
            }

            try {
                const minutes = historyRequest.minutes ?? 5;
                logger.info(`[SystemSocketModule] Client ${conn.id} requested history for ${minutes} minutes on cluster ${historyRequest.clusterId}`);
                const history = await this.metricsOrchestrator.getHistory(historyRequest);
                const response: MetricsHistoryResponse = {
                    clusterId: historyRequest.clusterId,
                    history
                };

                this.emitToSocket(conn.id, 'metrics:history', response);
            } catch (error) {
                logger.error(`[SystemSocketModule] Error fetching history: ${error}`);
            }
        });
    }

    async onShutdown(): Promise<void> {
        this.unsubscribeFromTeamSubscription?.();
        this.unsubscribeFromTeamSubscription = undefined;
        this.latestMetricsByTeamId.clear();
        this.teamIdByClusterIdCache.clear();
        this.metricsOrchestrator.stop();
        this.initialized = false;
    }

    private async broadcastTeamMetrics(allMetrics: ClusterSystemMetrics[]): Promise<void> {
        const nextMetricsByTeamId = await this.groupMetricsByTeamId(allMetrics);
        const teamIds = new Set<string>([
            ...this.latestMetricsByTeamId.keys(),
            ...nextMetricsByTeamId.keys()
        ]);

        this.latestMetricsByTeamId = nextMetricsByTeamId;

        for (const teamId of teamIds) {
            this.emitToRoom(`team:${teamId}`, 'metrics:all', nextMetricsByTeamId.get(teamId) ?? []);
        }
    }

    private async groupMetricsByTeamId(allMetrics: ClusterSystemMetrics[]): Promise<Map<string, ClusterSystemMetrics[]>> {
        const teamClusterIds = Array.from(new Set(allMetrics
            .map((metric) => metric.teamClusterId)
            .filter((teamClusterId): teamClusterId is string => typeof teamClusterId === 'string' && teamClusterId.length > 0)));

        if (teamClusterIds.length === 0) {
            return new Map<string, ClusterSystemMetrics[]>();
        }

        const teamIdByClusterId = new Map<string, string>();
        const missingClusterIds: string[] = [];

        for (const teamClusterId of teamClusterIds) {
            const cachedTeam = this.teamIdByClusterIdCache.get(teamClusterId);
            if (cachedTeam && cachedTeam.expiresAt > Date.now()) {
                teamIdByClusterId.set(teamClusterId, cachedTeam.teamId);
                continue;
            }

            missingClusterIds.push(teamClusterId);
        }

        if (missingClusterIds.length > 0) {
            const teamClusters = await this.teamClusterRepository.findAll({
                filter: {
                    _id: {
                        $in: missingClusterIds
                    }
                },
                page: 1,
                limit: missingClusterIds.length
            });

            for (const teamCluster of teamClusters.data) {
                const teamId = teamCluster.props.team;
                this.teamIdByClusterIdCache.set(teamCluster.id, {
                    expiresAt: Date.now() + TEAM_CLUSTER_TEAM_CACHE_TTL_MS,
                    teamId
                });
                teamIdByClusterId.set(teamCluster.id, teamId);
            }
        }

        const metricsByTeamId = new Map<string, ClusterSystemMetrics[]>();

        for (const metric of allMetrics) {
            if (!metric.teamClusterId) {
                continue;
            }

            const teamId = teamIdByClusterId.get(metric.teamClusterId);
            if (!teamId) {
                continue;
            }

            const teamMetrics = metricsByTeamId.get(teamId) ?? [];
            teamMetrics.push(metric);
            metricsByTeamId.set(teamId, teamMetrics);
        }

        return metricsByTeamId;
    }
}
