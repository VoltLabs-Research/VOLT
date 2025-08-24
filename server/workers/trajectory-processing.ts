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

import { extractTimestepInfo } from '@/utilities/lammps';
import { parentPort } from 'worker_threads';
import { join } from 'path';
import { unlink } from 'fs/promises';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import AtomisticExporter from '@/utilities/export/atoms';
import '@config/env';

const processJob = async (job: TrajectoryProcessingJob) => {
    console.log(`[Worker #${process.pid}] Starting job ${job.jobId} (chunk ${job.chunkIndex + 1}/${job.totalChunks})`);

    if(!job || !job.jobId){
        throw new Error('No job data received in message.');
    }

    try{
        const promises = job.files.map(async ({ frameData, frameFilePath }) => {
            console.log(`[Worker #${process.pid}] Processing timestep ${frameData.timestep}`);
            
            try{
                const glbFilePath = join(job.glbFolderPath, `${frameData.timestep}.glb`);
                const glbExporter = new AtomisticExporter();
                await glbExporter.exportAtomsToGLB(
                    frameFilePath,
                    glbFilePath,
                    extractTimestepInfo
                );
                
                console.log(`[Worker #${process.pid}] Completed timestep ${frameData.timestep}`);
            }catch(fileError){
                console.error(`[Worker #${process.pid}] Error processing file ${frameFilePath}:`, fileError);
            }
        });

        await Promise.all(promises);

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks
        });
        
        console.log(`[Worker #${process.pid}] Finished job ${job.jobId} successfully`);
        
    }catch(error){
        console.error(`[Worker #${process.pid}] Error processing job ${job.jobId}:`, error);
        
        // Clean up any remaining temp files
        for(const { frameFilePath } of job.files){
            try{
                await unlink(frameFilePath);
            }catch(unlinkError) {
                // Ignore cleanup errors
            }
        }
        
        parentPort?.postMessage({
            status: 'failed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};

const main = async () => {
    console.log(`[Worker #${process.pid}] Worker started`);
    
    parentPort?.on('message', async (message: { job: TrajectoryProcessingJob }) => {
        try {
            await processJob(message.job);
        } catch (error) {
            console.error(`[Worker #${process.pid}] Unhandled error:`, error);
            parentPort?.postMessage({
                status: 'failed',
                jobId: message.job?.jobId || 'unknown',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
};

main();