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

const LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS = {
    analysisProcessing: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    },
    artifactUpload: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    },
    trajectoryRasterization: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    },
    trajectoryGlbConversion: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    },
    cloudUpload: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    },
    trajectoryCompression: {
        maxRunningPerTrajectory: 1,
        maxRunningPerTeam: 0
    }
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
            { 'queueScopeLimits.trajectoryGlbConversion': { $exists: false } },
            { 'queueScopeLimits.cloudUpload': { $exists: false } },
            { 'queueScopeLimits.trajectoryCompression': { $exists: false } },
            {
                'queueScopeLimits.analysisProcessing.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.analysisProcessing.maxRunningPerTrajectory,
                'queueScopeLimits.analysisProcessing.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.analysisProcessing.maxRunningPerTeam,
                'queueScopeLimits.artifactUpload.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.artifactUpload.maxRunningPerTrajectory,
                'queueScopeLimits.artifactUpload.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.artifactUpload.maxRunningPerTeam,
                'queueScopeLimits.trajectoryRasterization.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryRasterization.maxRunningPerTrajectory,
                'queueScopeLimits.trajectoryRasterization.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryRasterization.maxRunningPerTeam,
                'queueScopeLimits.trajectoryGlbConversion.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryGlbConversion.maxRunningPerTrajectory,
                'queueScopeLimits.trajectoryGlbConversion.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryGlbConversion.maxRunningPerTeam,
                'queueScopeLimits.cloudUpload.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.cloudUpload.maxRunningPerTrajectory,
                'queueScopeLimits.cloudUpload.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.cloudUpload.maxRunningPerTeam,
                'queueScopeLimits.trajectoryCompression.maxRunningPerTrajectory': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryCompression.maxRunningPerTrajectory,
                'queueScopeLimits.trajectoryCompression.maxRunningPerTeam': LEGACY_TEAM_CLUSTER_QUEUE_SCOPE_LIMITS.trajectoryCompression.maxRunningPerTeam
            }
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
