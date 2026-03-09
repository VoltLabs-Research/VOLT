import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { ClusterSystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import logger from '@shared/infrastructure/logger';
import mongoose from 'mongoose';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';

const STALE_CLUSTER_THRESHOLD_MS = 15_000;

interface ClusterMetricIdentity {
    clusterId: string;
    teamClusterId: string | null;
};

@injectable()
export default class ClusterMetricsAggregator {
    constructor(
        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly metricsRepository: ISystemMetricsRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterRepository)
        private readonly teamClusterRepository: ITeamClusterRepository
    ) {}

    private async resolveClusterMetricIdentities(activeClusterIds: string[]): Promise<ClusterMetricIdentity[]> {
        if (!activeClusterIds.length) {
            return [];
        }

        const validTeamClusterIds = activeClusterIds.filter((clusterId) => mongoose.Types.ObjectId.isValid(clusterId));

        if (!validTeamClusterIds.length) {
            return activeClusterIds.map((clusterId) => ({
                clusterId,
                teamClusterId: null
            }));
        }

        const teamClusters = await this.teamClusterRepository.export({
            filter: {
                _id: {
                    $in: validTeamClusterIds
                }
            }
        });

        const teamClusterIds = new Set(teamClusters.map((teamCluster) => teamCluster.id));

        return activeClusterIds.map((clusterId) => ({
            clusterId,
            teamClusterId: teamClusterIds.has(clusterId) ? clusterId : null
        }));
    }

    async getClusterAnalysisCounts(): Promise<Record<string, number>> {
        try {
            return this.analysisRepository.getCompletedFramesByCluster();
        } catch (error: unknown) {
            logger.error(`Error aggregating analysis counts: ${error}`);
            return {};
        }
    }

    async getAllClustersMetrics(): Promise<ClusterSystemMetrics[]> {
        try {
            const cutoffTime = Date.now() - STALE_CLUSTER_THRESHOLD_MS;

            const activeClusterIds = await this.metricsRepository.listActiveClusterIds(cutoffTime);
            const clusterIdentities = await this.resolveClusterMetricIdentities(activeClusterIds);
            if (!clusterIdentities.length) return [];

            const analysisCounts = await this.getClusterAnalysisCounts();

            const allMetrics = await Promise.all(clusterIdentities.map(async ({ clusterId, teamClusterId }) => {
                const metric = await this.metricsRepository.getLatestByClusterId(clusterId);
                if (!metric) {
                    return null;
                }

                return {
                    ...metric,
                    teamClusterId: metric.teamClusterId ?? teamClusterId,
                    analysisCount: analysisCounts[clusterId] || 0,
                    clusterId
                } satisfies ClusterSystemMetrics;
            }));

            return allMetrics.filter((metric): metric is ClusterSystemMetrics => !!metric);
        } catch (error: unknown) {
            logger.error(`Error collecting multi-cluster metrics: ${error}`);
            return [];
        }
    }
}
