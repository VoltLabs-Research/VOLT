import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import type { ClusterSystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import TeamClusterRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/TeamClusterRepository';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import mongoose from 'mongoose';

const STALE_CLUSTER_THRESHOLD_MS = 15_000;
const ANALYSIS_COUNTS_CACHE_TTL_MS = 10_000;
const CLUSTER_IDENTITY_CACHE_TTL_MS = 30_000;

interface ClusterMetricIdentity {
    clusterId: string;
    teamClusterId: string | null;
};

@Singleton()
export default class ClusterMetricsAggregator {
    private readonly clusterIdentityCache = new Map<string, {
        expiresAt: number;
        value: ClusterMetricIdentity;
    }>();
    private cachedAnalysisCounts: {
        expiresAt: number;
        value: Record<string, number>;
    } | null = null;
    private pendingAnalysisCounts: Promise<Record<string, number>> | null = null;

    constructor(
        
        private readonly metricsRepository: SystemMetricsRedisRepository,
        
        private readonly analysisRepository: AnalysisRepository,
        
        private readonly teamClusterRepository: TeamClusterRepository
    ) {}

    private async resolveClusterMetricIdentities(activeClusterIds: string[]): Promise<ClusterMetricIdentity[]> {
        if (!activeClusterIds.length) {
            return [];
        }

        const identitiesByClusterId = new Map<string, ClusterMetricIdentity>();
        const missingValidTeamClusterIds: string[] = [];

        for (const clusterId of activeClusterIds) {
            const cachedIdentity = this.clusterIdentityCache.get(clusterId);
            if (cachedIdentity && cachedIdentity.expiresAt > Date.now()) {
                identitiesByClusterId.set(clusterId, cachedIdentity.value);
                continue;
            }

            if (!mongoose.Types.ObjectId.isValid(clusterId)) {
                const identity = {
                    clusterId,
                    teamClusterId: null
                };
                this.clusterIdentityCache.set(clusterId, {
                    expiresAt: Date.now() + CLUSTER_IDENTITY_CACHE_TTL_MS,
                    value: identity
                });
                identitiesByClusterId.set(clusterId, identity);
                continue;
            }

            missingValidTeamClusterIds.push(clusterId);
        }

        if (missingValidTeamClusterIds.length > 0) {
            const teamClusters = await this.teamClusterRepository.export({
                filter: {
                    _id: {
                        $in: missingValidTeamClusterIds
                    }
                }
            });

            const teamClusterIds = new Set(teamClusters.map((teamCluster) => teamCluster.id));
            for (const clusterId of missingValidTeamClusterIds) {
                const identity = {
                    clusterId,
                    teamClusterId: teamClusterIds.has(clusterId) ? clusterId : null
                };
                this.clusterIdentityCache.set(clusterId, {
                    expiresAt: Date.now() + CLUSTER_IDENTITY_CACHE_TTL_MS,
                    value: identity
                });
                identitiesByClusterId.set(clusterId, identity);
            }
        }

        return activeClusterIds
            .map((clusterId) => identitiesByClusterId.get(clusterId))
            .filter((identity): identity is ClusterMetricIdentity => Boolean(identity));
    }

    async getClusterAnalysisCounts(): Promise<Record<string, number>> {
        const cachedAnalysisCounts = this.cachedAnalysisCounts;
        if (cachedAnalysisCounts && cachedAnalysisCounts.expiresAt > Date.now()) {
            return cachedAnalysisCounts.value;
        }

        if (this.pendingAnalysisCounts) {
            return this.pendingAnalysisCounts;
        }

        this.pendingAnalysisCounts = this.analysisRepository.getCompletedFramesByCluster()
            .then((counts) => {
                this.cachedAnalysisCounts = {
                    expiresAt: Date.now() + ANALYSIS_COUNTS_CACHE_TTL_MS,
                    value: counts
                };
                return counts;
            })
            .catch((error: unknown) => {
                logger.error(`Error aggregating analysis counts: ${error}`);
                return {};
            })
            .finally(() => {
                this.pendingAnalysisCounts = null;
            });

        return this.pendingAnalysisCounts;
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
