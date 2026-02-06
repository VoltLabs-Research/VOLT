import { IJobQueueService } from '@modules/jobs/domain/ports/IJobQueueService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { container } from 'tsyringe';

/**
 * Start all job queues.
 */
const startQueues = async (): Promise<void> => {
    const trajectoryQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.TrajectoryProcessingQueue);
    const cloudUploadQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.CloudUploadQueue);
    const rasterQueue = container.resolve<IJobQueueService>(RASTER_TOKENS.RasterizerQueue);
    const analysisQueue = container.resolve<IJobQueueService>(PLUGIN_TOKENS.AnalysisProcessingQueue);

    await Promise.all([
        trajectoryQueue.start(),
        cloudUploadQueue.start(),
        rasterQueue.start(),
        analysisQueue.start()
    ]);
};

export default startQueues;