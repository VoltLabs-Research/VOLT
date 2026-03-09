import { IJobQueueService } from '@modules/jobs/domain/port/IJobQueueService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { container } from 'tsyringe';

/**
 * Start all job queues.
 */
const startQueues = async (): Promise<void> => {
    const cloudUploadQueue = container.resolve<IJobQueueService>(TRAJECTORY_TOKENS.CloudUploadQueue);

    await Promise.all([
        cloudUploadQueue.start()
    ]);
};

export default startQueues;
