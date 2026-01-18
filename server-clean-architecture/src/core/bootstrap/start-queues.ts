import { IJobQueueService } from '@modules/jobs/domain/ports/IJobQueueService';
import { RASTER_TOKENS } from '@modules/raster/infrastructure/di/RasterTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { container } from 'tsyringe';

/**
 * Start all job queues.
 */
const startQueues = async (): Promise<void> => {
    const trajectoryQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.TrajectoryProcessingQueue);
    const cloudUploadQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.CloudUploadQueue);
    const rasterQueue = container.resolve<IJobQueueService>(RASTER_TOKENS.RasterizerQueue);

    await Promise.all([
        trajectoryQueue.start(),
        cloudUploadQueue.start(),
        rasterQueue.start()
    ]);
};

export default startQueues;