import { DEFAULT_TEAM_CLUSTER_QUEUE_CONCURRENCY } from '@modules/team-cluster/domain/entities/TeamCluster';
import TeamClusterModel from '@modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import logger from '@shared/infrastructure/logger';

export const backfillTeamClusterQueueConcurrency = async (): Promise<void> => {
    const result = await TeamClusterModel.updateMany({
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

    if (result.modifiedCount > 0) {
        logger.info({
            action: 'team-cluster.queue-concurrency.backfill',
            modifiedCount: result.modifiedCount
        }, 'Backfilled team cluster queue concurrency');
    }
};
