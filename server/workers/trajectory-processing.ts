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
import { readFile, unlink } from 'fs/promises';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import LAMMPSToGLTFExporter from '@/utilities/export/atoms';
import '@config/env';

const logMemoryUsage = (context: string) => {
    const usage = process.memoryUsage();
    console.log(`[Worker #${process.pid}] ${context} - Memory:`, {
        rss: `${Math.round(usage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)} MB`
    });
};

const checkMemoryPressure = (): boolean => {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    
    if(heapUsedMB > 1500 || (heapUsedMB / heapTotalMB) > 0.85){
        console.warn(`[Worker #${process.pid}] High memory usage: ${heapUsedMB}MB`);
        
        if(global.gc){
            console.log(`[Worker #${process.pid}] Forcing garbage collection...`);
            global.gc();
        }
        
        return true;
    }
    
    return false;
};

const processJob = async (job: TrajectoryProcessingJob) => {
    console.log(`[Worker #${process.pid}] Starting job ${job.jobId} (chunk ${job.chunkIndex + 1}/${job.totalChunks})`);
    logMemoryUsage('Job start');

    if(!job || !job.jobId){
        throw new Error('No job data received in message.');
    }

    try{
        // Process files sequentially
        for(let i = 0; i < job.files.length; i++){
            const { frameData, tempFilePath } = job.files[i];
            
            console.log(`[Worker #${process.pid}] Processing file ${i + 1}/${job.files.length}: timestep ${frameData.timestep}`);
            
            // Check memory before processing
            if(checkMemoryPressure()){
                // Wait a bit for GC to complete
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            try{
                // Read file content
                const content = await readFile(tempFilePath, 'utf-8');
                
                // Create GLTF file path
                const gltfFilePath = join(job.gltfFolderPath, `${frameData.timestep}.gltf`);
                
                // Process GLTF export
                const gltfExporter = new LAMMPSToGLTFExporter();
                gltfExporter.exportAtomsToGLTF(
                    tempFilePath,
                    gltfFilePath,
                    extractTimestepInfo,
                    { maxInstancesPerMesh: 5000 }
                );

                // Clean up temp file immediately after processing
                try{
                    await unlink(tempFilePath);
                }catch(unlinkError){
                    console.warn(`[Worker #${process.pid}] Could not delete temp file ${tempFilePath}:`, unlinkError);
                }

                // Force GC every 5 files
                if(i % 5 === 0 && global.gc){
                    global.gc();
                }

                console.log(`[Worker #${process.pid}] Completed timestep ${frameData.timestep}`);
                
            }catch(fileError){
                console.error(`[Worker #${process.pid}] Error processing file ${tempFilePath}:`, fileError);
                
                // Try to clean up temp file even on error
                try{
                    await unlink(tempFilePath);
                }catch(unlinkError){
                    // Ignore cleanup errors
                }
                
                // Continue with next file instead of failing entire job
                continue;
            }
        }

        logMemoryUsage('Job completed');

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            chunkIndex: job.chunkIndex,
            totalChunks: job.totalChunks
        });
        
        console.log(`[Worker #${process.pid}] Finished job ${job.jobId} successfully`);
        
    }catch(error){
        logMemoryUsage('Job error');
        console.error(`[Worker #${process.pid}] Error processing job ${job.jobId}:`, error);
        
        // Clean up any remaining temp files
        for(const { tempFilePath } of job.files){
            try{
                await unlink(tempFilePath);
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
    logMemoryUsage('Worker initialization');
    
    // Monitor memory every 30 seconds
    setInterval(() => {
        logMemoryUsage('Periodic check');
        checkMemoryPressure();
    }, 30000);
    
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