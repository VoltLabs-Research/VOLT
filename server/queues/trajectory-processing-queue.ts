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

import { QueueOptions } from '@/types/queues/base-processing-queue';
import { TrajectoryProcessingJob } from '@/types/queues/trajectory-processing-queue';
import { BaseProcessingQueue } from './base-processing-queue';
import { getRasterizerQueue } from './index';
import { v4 } from 'uuid';
import { RasterizerJob } from '@/types/services/rasterizer-queue';
import { join } from 'path';
import { existsSync } from 'fs';
import { Trajectory } from '@/models';
import TrajectoryFS from '@/services/trajectory-fs';
import path from 'path';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
    private firstChunkProcessed = new Set<string>();

    constructor(){
        const options: QueueOptions = {
            queueName: 'trajectory-processing-queue',
            workerPath: path.resolve(__dirname, '../workers/trajectory-processing.ts'),
            maxConcurrentJobs: 20,
            cpuLoadThreshold: 60,
            ramLoadThreshold: 70,
            useStreamingAdd: true
        };
        
        super(options);

        // Listen for job completion to trigger preview generation
        this.on('jobCompleted', (data: any) => {
            this.onJobCompleted(data).catch(error => {
                console.error('Unhandled error in onJobCompleted handler:', error);
            });
        });
    }

    private async onJobCompleted(data: any): Promise<void> {
        const job = data.job as TrajectoryProcessingJob;
        
        // Only process if this is the first chunk (index 0)
        if (job.chunkIndex !== 0) return;

        const trackingKey = `${job.trajectoryId}:preview-scheduled`;
        if (this.firstChunkProcessed.has(trackingKey)) return;

        this.firstChunkProcessed.add(trackingKey);

        try {
            console.log(`First chunk completed for trajectory ${job.trajectoryId}, scheduling preview generation`);
            
            // Get first frame timestep from the job
            const firstFrame = job.files?.[0];
            if (!firstFrame || firstFrame.frameData?.timestep === undefined) {
                console.warn(`No first frame data found for trajectory ${job.trajectoryId}`);
                return;
            }

            const firstFrameTimestep = firstFrame.frameData.timestep;
            const glbPath = join(job.glbFolderPath, `${firstFrameTimestep}.glb`);

            // Check if GLB file exists
            if (!existsSync(glbPath)) {
                console.warn(`GLB file not found at ${glbPath}`);
                return;
            }

            // Get trajectory to access team info and folder structure
            const trajectory = await Trajectory.findById(job.trajectoryId);
            if (!trajectory) {
                console.warn(`Trajectory not found: ${job.trajectoryId}`);
                return;
            }

            const tfs = new TrajectoryFS(trajectory.folderId);
            
            // Output preview PNG at {root}/preview.png
            const previewPath = join(tfs.root, 'preview.png');

            const rasterizerQueue = getRasterizerQueue();
            
            // Create a rasterizer job for preview
            const previewJob: RasterizerJob = {
                jobId: v4(),
                trajectoryId: job.trajectoryId,
                teamId: job.teamId,
                sessionId: job.sessionId,
                sessionStartTime: job.sessionStartTime,
                name: 'Headless Rasterizer (Preview)',
                message: `${trajectory.name} - Preview frame ${firstFrameTimestep}`,
                opts: {
                    inputPath: glbPath,
                    outputPath: previewPath,
                    width: 1024,
                    height: 768,
                    background: '#1a1a1a',
                    fov: 45,
                    maxPoints: 100000,
                    up: 'z',
                    az: 45,
                    el: 30,
                    distScale: 1.0
                }
            };

            // If this is part of a session, increment the remaining counter to include this rasterizer job
            if (job.sessionId) {
                const counterKey = `session:${job.sessionId}:remaining`;
                await this.redis.incr(counterKey);
                console.log(`Incremented session counter for rasterizer preview job for trajectory ${job.trajectoryId}`);
            }

            await rasterizerQueue.addJobs([previewJob]);
            console.log(`Preview generation job queued for trajectory ${job.trajectoryId}, frame ${firstFrameTimestep}`);
        } catch (error) {
            console.error(`Failed to queue preview generation for trajectory ${job.trajectoryId}:`, error);
            // Don't throw - trajectory processing shouldn't fail if preview generation fails
        }
    }

    protected deserializeJob(rawData: string): TrajectoryProcessingJob {
        try{
            return JSON.parse(rawData) as TrajectoryProcessingJob;
        }catch(error){
            console.error(`[${this.queueName}] Error deserializing job:`, error);
            throw new Error('Failed to deserialize job data');
        }
    }
}