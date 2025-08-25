import { parentPort } from 'node:worker_threads';
import HeadlessRasterizer from '@/services/headless-rasterizer';
import { RasterizerJob } from '@/types/services/rasterizer-queue';

const processJob = async (job: RasterizerJob) => {
    try{
        console.log(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);

        // @ts-ignore
        const raster = new HeadlessRasterizer(job.opts);
        await raster.render();

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId
        });

        console.log(`[Worker #${process.pid}] Finished job ${job.trajectoryId} successfully.`);
    }catch(error: any){
        console.error(`[Worker #${process.pid}] An error occurred while processing trajectory ${job.trajectoryId}:`, error);

        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            error: error.message
        });
    }
};

const main = async () => {
    console.log(`[Worker #${process.pid}] Worker started`);

    parentPort?.on('message', async (message: { job: RasterizerJob }) => {
        try{
            await processJob(message.job);
        }catch(error){
            console.error(`[Worker #${process.pid}] Unhandled error:`, error);
        }
    });
};

main();