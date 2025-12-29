import DumpStorage from '@/services/dump-storage';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import { parentPort } from 'node:worker_threads';
import logger from '@/logger';
import '@config/env';

const processJob = async (job: CloudUploadJob): Promise<void> => {
    const { jobId, trajectoryId, timestep } = job;

    const localPath = DumpStorage.getCachePath(trajectoryId, timestep);

    await DumpStorage.saveDump(trajectoryId, timestep, localPath, (progress) => {
        /*parentPort?.postMessage({
            jobId,
            status: 'progress',
            progress
        });*/
    });
    
    parentPort?.postMessage({
        status: 'completed',
        jobId
    });
};

const main = async () => {
    parentPort?.on('message', async (message: { job: CloudUploadJob }) => {
        try{
            await processJob(message.job);
        }catch(err){
            logger.error(`[Worker #${process.pid}] Fatal Exception: ${err}`);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                error: 'Fatal worker exception'
            });
        }
    });
};

main();