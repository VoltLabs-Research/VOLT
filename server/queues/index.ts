/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import { AnalysisProcessingQueue } from '@/queues/analysis-processing-queue';
import { TrajectoryProcessingQueue } from '@/queues/trajectory-processing-queue';
import { RasterizerQueue } from '@/queues/rasterizer-queue';
import { SSHImportQueue } from './ssh-import-queue';
import { CloudUploadQueue } from './cloud-upload';

let analysisQueueInstance: AnalysisProcessingQueue | null = null;
let trajectoryProcessingQueueInstance: TrajectoryProcessingQueue | null = null;
let rasterizerQueue: RasterizerQueue | null = null;
let sshImportQueue: SSHImportQueue | null = null;
let cloudUploadQueue: CloudUploadQueue | null = null;

export const getCloudUploadQueue = (): CloudUploadQueue => {
    if(!cloudUploadQueue){
        cloudUploadQueue = new CloudUploadQueue();
    }

    return cloudUploadQueue;
};

export const getSSHImportQueue = (): SSHImportQueue => {
    if(!sshImportQueue){
        sshImportQueue = new SSHImportQueue();
    }

    return sshImportQueue;
};

export const getAnalysisQueue = (): AnalysisProcessingQueue => {
    if(!analysisQueueInstance){
        analysisQueueInstance = new AnalysisProcessingQueue();
    }

    return analysisQueueInstance;
};

export const getRasterizerQueue = (): RasterizerQueue => {
    if(!rasterizerQueue){
        rasterizerQueue = new RasterizerQueue();
    }

    return rasterizerQueue;
};

export const getTrajectoryProcessingQueue = (): TrajectoryProcessingQueue => {
    if(!trajectoryProcessingQueueInstance){
        trajectoryProcessingQueueInstance = new TrajectoryProcessingQueue();
    }

    return trajectoryProcessingQueueInstance;
};
