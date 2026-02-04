import { BaseProcessingQueue } from '@/queues/base';
import { QueueOptions } from '@/types/queues/base-processing-queue';
import { Queues } from '@/constants/queues';
import { SSHImportJob } from '@/types/services/ssh-import-queue';
import * as path from 'node:path';
import createTrajectory from '@/utilities/trajectory/create-trajectory';


export class SSHImportQueue extends BaseProcessingQueue<SSHImportJob> {
    constructor() {
        const options: QueueOptions = {
            queueName: Queues.SSH_IMPORT,
            workerPath: path.resolve(__dirname, '../workers/ssh-import.ts'),
            useWorkerThreads: true
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