import DumpStorage from '@/services/dump-storage';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import { parentPort } from 'node:worker_threads';
import logger from '@/logger';
import '@config/env';

export const processJob = async (job: CloudUploadJob): Promise<any> => {
    const { jobId, trajectoryId, timestep } = job;
    const localPath = DumpStorage.getCachePath(trajectoryId, timestep);

    await DumpStorage.saveDump(trajectoryId, timestep, localPath, () => { });

    return {
        status: 'completed',
        jobId,
        timestep
    };
};

const main = async () => {
    parentPort?.on('message', async (message: { job: CloudUploadJob }) => {
        try {
            const result = await processJob(message.job);
            parentPort?.postMessage(result);
        } catch (err) {
            logger.error(`[Worker #${process.pid}] Fatal Exception: ${err}`);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                timestep: message.job?.timestep,
                error: 'Fatal worker exception'
            });
        }
    });
};

main();