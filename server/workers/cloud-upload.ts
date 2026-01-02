import DumpStorage from '@/services/trajectory/dump-storage';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import { parentPort } from 'node:worker_threads';
import logger from '@/logger';
import * as fs from 'node:fs/promises';
import '@config/env';

export const processJob = async (job: CloudUploadJob): Promise<any> => {
    const { jobId, trajectoryId, timestep } = job;
    const localPath = DumpStorage.getCachePath(trajectoryId, timestep);

    try {
        await DumpStorage.saveDump(trajectoryId, timestep, localPath, () => { });

        return {
            status: 'completed',
            jobId,
            timestep
        };
    } finally {
        // TODO: Other more elegant instruction for this
        await new Promise((resolve) => setTimeout(async () => {
            await fs.rm(localPath);
            resolve(true);
        }, 1000));
    }
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