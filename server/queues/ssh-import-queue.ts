/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import { BaseProcessingQueue } from '@/queues/base-processing-queue';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { Queues } from '@/constants/queues';
import { SSHImportJob } from '@/types/services/ssh-import-queue';
import * as path from 'node:path';
import createTrajectory from '@/utilities/create-trajectory';

export class SSHImportQueue extends BaseProcessingQueue<SSHImportJob> {
    constructor() {
        const options: QueueOptions = {
            queueName: Queues.SSH_IMPORT,
            workerPath: path.resolve(__dirname, '../workers/ssh-import.ts')
        };

        super(options);

        this.on('jobCompleted', async ({ result }) => {
            if (result) {
                await createTrajectory(result);
            }
        });
    }

    protected deserializeJob(rawData: string): SSHImportJob {
        return JSON.parse(rawData) as SSHImportJob;
    }
}