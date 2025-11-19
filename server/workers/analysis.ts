/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { parentPort } from 'worker_threads';
import { Analysis } from '@/models';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import Plugin from '@/services/plugins/plugin';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import path from 'node:path';
import '@config/env';


const processJob = async (job: AnalysisJob): Promise<void> => {
    if(!job){
        throw new Error('No job data received in message.');
    }

    try{
        console.log(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);
        const plugin = new Plugin(
            job.plugin,
            job.trajectoryId.toString(),
            job.analysisId.toString(),
            job.folderPath.toString()
        );
        await plugin.register();
        await plugin.evaluate(job.inputFile, job.config);

        // TODO: This should be more robust; besides, there's an existing function for this.
        const frameNumber = Number(path.basename(job.inputFile));

        const update = {
            $inc: { completedFrames: 1 },
            $set: { lastFrameProcessed: frameNumber }
        };

        const updated = await Analysis.findOneAndUpdate({ _id: job.analysisId }, update, { new: true });
        if(updated && updated.totalFrames && (updated.completedFrames ?? 0) >= updated.totalFrames){
            await Analysis.updateOne({ _id: job.analysisId }, { status: 'completed', finishedAt: new Date() });
        }

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            result: null
        });
        console.log(`[Worker #${process.pid}] Finished job ${job.trajectoryId} successfully.`);
    }catch(err: any){
        console.error(`[Worker #${process.pid}] An error occurred while processing trajectory ${job.trajectoryId}:`, err);
        await Analysis.updateOne({ _id: job.analysisId }, { status: 'failed', finishedAt: new Date() }).catch(() => { /** noop */ });
        
        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            error: err.message
        });
    }
};

const main = async () => {
    try{
        await mongoConnector();
        console.log(`[Worker #${process.pid}] Connected to MongoDB and ready to process jobs.`);
    }catch(dbError){
        console.error(`[Worker #${process.pid}] Failed to connect to MongoDB. Worker will not be able to process jobs.`, dbError);
        process.exit(1);
    }

    parentPort?.on('message', (message: { job: AnalysisJob }) => {
        processJob(message.job);
    });
};

main();