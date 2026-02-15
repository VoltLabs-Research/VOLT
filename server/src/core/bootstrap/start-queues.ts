import { IJobQueueService } from '@modules/jobs/domain/ports/IJobQueueService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { container } from 'tsyringe';
import logger from '@shared/infrastructure/logger';

/**
 * Start all job queues.
 */
const startQueues = async (): Promise<void> => {
    const queues: { name: string; instance: IJobQueueService }[] = [
        { name: 'TrajectoryProcessingQueue', instance: container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.TrajectoryProcessingQueue) },
        { name: 'CloudUploadQueue', instance: container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.CloudUploadQueue) },
        { name: 'RasterizerQueue', instance: container.resolve<IJobQueueService>(RASTER_TOKENS.RasterizerQueue) },
        { name: 'AnalysisProcessingQueue', instance: container.resolve<IJobQueueService>(PLUGIN_TOKENS.AnalysisProcessingQueue) }
    ];

    // CORE-012: Use Promise.allSettled so partial failures don't block everything
    const results = await Promise.allSettled(
        queues.map(q => q.instance.start())
    );

    results.forEach((result, index) => {
        if (result.status === 'rejected') {
            logger.error(`Failed to start queue ${queues[index].name}:`, result.reason);
        }
    });

    const failedCount = results.filter(r => r.status === 'rejected').length;
    if (failedCount > 0) {
        logger.warn(`${failedCount}/${queues.length} queues failed to start`);
    }
};

export default startQueues;
