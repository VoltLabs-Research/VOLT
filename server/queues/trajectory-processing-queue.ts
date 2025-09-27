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
import path from 'path';

export class TrajectoryProcessingQueue extends BaseProcessingQueue<TrajectoryProcessingJob> {
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