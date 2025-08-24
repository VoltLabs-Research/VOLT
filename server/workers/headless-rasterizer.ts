import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import HeadlessRasterizer, { HeadlessRasterizerOptions } from '@/services/headless-rasterizer';

type HeadlessRasterizerJob = { 
    opts: HeadlessRasterizerOptions; 
};

const processJob = async (job: HeadlessRasterizerJob) => {
    try{
        const raster = new HeadlessRasterizer(job.opts);
        raster.render();
    }catch(error){
        console.error(`[Worker #${process.pid}]`, error);
    }
};

const main = async () => {
    console.log(`[Worker #${process.pid}] Worker started`);

    parentPort?.on('message', async (message: { job: HeadlessRasterizerJob }) => {
        try{
            await processJob(message.job);
        }catch(error){
            console.error(`[Worker #${process.pid}] Unhandled error:`, error);
        }
    });
};

main();