import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
} from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterModel from '@modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import logger from '@shared/infrastructure/logger';

export const backfillTeamClusterQueueConcurrency = async (): Promise<void> => {
    const queueConcurrencyResult = await TeamClusterModel.updateMany({
        $or: [
            { queueConcurrency: { $exists: false } },
            { 'queueConcurrency.analysis': { $exists: false } },
            { 'queueConcurrency.rasterizer': { $exists: false } },
            { 'queueConcurrency.glbPreprocessing': { $exists: false } },
            { 'queueConcurrency.sshImport': { $exists: false } }
        ]
    }, {
        $set: {
            queueConcurrency: DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY
        }
    });

    const queueScopeLimitsResult = await TeamClusterModel.updateMany({
        $or: [
            { queueScopeLimits: { $exists: false } },
            { 'queueScopeLimits.analysisProcessing': { $exists: false } },
            { 'queueScopeLimits.artifactUpload': { $exists: false } },
            { 'queueScopeLimits.trajectoryGlbConversion': { $exists: false } },
            { 'queueScopeLimits.cloudUpload': { $exists: false } },
            { 'queueScopeLimits.trajectoryCompression': { $exists: false } }
        ]
    }, {
        $set: {
            queueScopeLimits: DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
        }
    });

    if (queueConcurrencyResult.modifiedCount > 0) {
        logger.info({
            action: 'team-cluster.queue-concurrency.backfill',
            modifiedCount: queueConcurrencyResult.modifiedCount
        }, 'Backfilled team cluster queue concurrency');
    }

    if (queueScopeLimitsResult.modifiedCount > 0) {
        logger.info({
            action: 'team-cluster.queue-scope-limits.backfill',
            modifiedCount: queueScopeLimitsResult.modifiedCount
        }, 'Backfilled team cluster queue scope limits');
    }
};
