import { parentPort } from 'node:worker_threads';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { putObject } from '@/utilities/buckets';
import { initializeMinio, SYS_BUCKETS } from '@/config/minio';
import HeadlessRasterizer from '@/services/headless-rasterizer';
import logger from '@/logger';
import * as fs from 'node:fs/promises';

const processJob = async (job: RasterizerJob) => {
    try{
        logger.info(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);
        // @ts-ignore
        const raster = new HeadlessRasterizer(job.opts);
        const buffer = await raster.render();

        parentPort?.postMessage({ status: 'completed', jobId: job.jobId });

        const objectName = `trajectory-${job.trajectoryId}/previews/timestep-${job.timestep}.png`;
        await fs.unlink(job.opts.inputPath as string);
        await putObject(objectName, SYS_BUCKETS.RASTERIZER, buffer, {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=86400'
        });
        
        logger.info(`[Worker #${process.pid}] Finished job ${job.trajectoryId} successfully.`);
    }catch(error: any){
        logger.error(`[Worker #${process.pid}] An error occurred while processing trajectory ${job.trajectoryId}: ${error}`);

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            error: error.message
        });
    }
};

const main = async () => {
    await initializeMinio();
    logger.info(`[Worker #${process.pid}] Worker started`);

    parentPort?.on('message', async (message: { job: RasterizerJob }) => {
        try{
            await processJob(message.job);
        }catch(error){
            logger.error(`[Worker #${process.pid}] Unhandled error: ${error}`);
        }
    });
};

main();