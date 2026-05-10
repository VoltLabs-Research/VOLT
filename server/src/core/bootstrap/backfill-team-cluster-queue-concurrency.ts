import {
    DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY,
    DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
} from '@modules/cluster/domain/entities/TeamCluster';
import TeamClusterModel from '@modules/cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import logger from '@shared/infrastructure/logger';

const LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY = {
    analysis: 5,
    rasterizer: 3,
    glbPreprocessing: 5,
    artifactUpload: 8,
    sshImport: 1
};

export const backfillTeamClusterQueueConcurrency = async (): Promise<void> => {
    const queueConcurrencyResult = await TeamClusterModel.updateMany({
        $or: [
            { queueConcurrency: { $exists: false } },
            { 'queueConcurrency.analysis': { $exists: false } },
            { 'queueConcurrency.rasterizer': { $exists: false } },
            { 'queueConcurrency.glbPreprocessing': { $exists: false } },
            { 'queueConcurrency.artifactUpload': { $exists: false } },
            { 'queueConcurrency.sshImport': { $exists: false } },
            { 'queueConcurrency.pluginWarmup': { $exists: false } },
            {
                'queueConcurrency.analysis': LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY.analysis,
                'queueConcurrency.rasterizer': LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY.rasterizer,
                'queueConcurrency.glbPreprocessing': LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY.glbPreprocessing,
                'queueConcurrency.artifactUpload': LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY.artifactUpload,
                'queueConcurrency.sshImport': LEGACY_TEAM_CLUSTER_QUEUE_CONCURRENCY.sshImport
            }
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
            { 'queueScopeLimits.trajectoryRasterization': { $exists: false } },
            { 'queueScopeLimits.trajectoryGlbConversion': { $exists: false } }
        ]
    }, {
        $set: {
            queueScopeLimits: DEFAULT_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS
        }
    });

    if (queueConcurrencyResult.modifiedCount > 0) {
        logger.info(`Backfilled team cluster queue concurrency modifiedCount=${queueConcurrencyResult.modifiedCount}`);
    }

    if (queueScopeLimitsResult.modifiedCount > 0) {
        logger.info(`Backfilled team cluster queue scope limits modifiedCount=${queueScopeLimitsResult.modifiedCount}`);
    }
};
