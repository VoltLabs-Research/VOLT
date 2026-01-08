
import { BaseWorker } from './base-worker';
import { CloudUploadJob } from '@/types/services/cloud-upload';
import DumpStorage from '@/services/trajectory/dump-storage';
import * as fs from 'node:fs/promises';

class CloudUploadWorker extends BaseWorker<CloudUploadJob> {
    protected async perform(job: CloudUploadJob): Promise<void> {
        const { jobId, trajectoryId, timestep } = job;
        const localPath = DumpStorage.getCachePath(trajectoryId, timestep);

        try {
            await DumpStorage.saveDump(trajectoryId, timestep, localPath, () => { });

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep
            });
        } finally {
            // Wait slightly before deleting to ensure completion is registered? 
            // Original code had a timeout, reproducing simplistically but cleaner.
            setTimeout(async () => {
                await fs.rm(localPath).catch(() => { });
            }, 1000);
        }
    }
}

BaseWorker.start(CloudUploadWorker);