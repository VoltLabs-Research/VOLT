import { inject, injectable } from 'tsyringe';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import logger from '@shared/infrastructure/logger';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import type { ClusterSystemMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';

const STALE_CLUSTER_THRESHOLD_MS = 15_000;

@injectable()
export default class ClusterMetricsAggregator {
    constructor(
        @inject(SYSTEM_TOKENS.SystemMetricsRepository)
        private readonly metricsRepository: ISystemMetricsRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ) {}

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

            const clusters = await this.metricsRepository.listActiveClusterIds(cutoffTime);
            if (!clusters.length) return [];

            const analysisCounts = await this.getClusterAnalysisCounts();
            const allMetrics: ClusterSystemMetrics[] = [];

            for (const clusterId of clusters) {
                const metric = await this.metricsRepository.getLatestByClusterId(clusterId);
                if (!metric) continue;

                allMetrics.push({
                    ...metric,
                    analysisCount: analysisCounts[clusterId] || 0,
                    clusterId
                });
            }

            return allMetrics;
        } catch (error: unknown) {
            logger.error(`Error collecting multi-cluster metrics: ${error}`);
            return [];
        }
    }
}
