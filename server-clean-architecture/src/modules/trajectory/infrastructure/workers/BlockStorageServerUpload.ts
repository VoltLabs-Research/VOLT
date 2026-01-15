import { initializeMinio } from '@/src/core/minio';
import { container } from 'tsyringe';
import TrajectoryDumpStorageService from '@/src/modules/trajectory/infrastructure/services/TrajectoryDumpStorageService';
import BaseWorker from '@/src/shared/infrastructure/workers/BaseWorker';
import logger from '@/src/shared/infrastructure/logger';
import fs from 'node:fs/promises';

export interface BlockStorageServerUploadJob{
    jobId: string;
    trajectoryId: string;
    trajectoryName: string;
    teamId: string;
    timestep: number;
    name?: string;
    message?: string;
    sessionId?: string;
};

class BlockStorageServerUpload extends BaseWorker<BlockStorageServerUploadJob>{
    private dumpStorage!: TrajectoryDumpStorageService;

    protected async setup(): Promise<void> {
        await this.connectDB();
        await initializeMinio();
        this.dumpStorage = container.resolve(TrajectoryDumpStorageService);
    }

    protected async perform(job: BlockStorageServerUploadJob): Promise<void> {
        const { jobId, trajectoryId, timestep } = job;

        try{
            const localPath = this.dumpStorage.getCachePath(trajectoryId, String(timestep));

            const fileExists = await fs.access(localPath).then(() => true).catch(() => false);
            if(!fileExists){
                logger.warn(`@block-storage-server-upload - #${process.pid} local dump not found: ${localPath}`);
                this.sendMessage({
                    status: 'failed',
                    jobId,
                    timestep,
                    error: 'Local dump file not found'
                });
                return;
            }

            // Read and upload to MinIO
            const content = await fs.readFile(localPath, 'utf-8');
            await this.dumpStorage.saveDump(trajectoryId, String(timestep), content);

            logger.info(`@block-storage-server-upload - #${process.pid} block storage server upload job ${jobId} completed for timestep ${timestep}`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep
            });

            // Cleanup local file after delay
            // TODO: HANDLE LOCK
            // IF NOT USED THEN DELETE
            setTimeout(async () => {
                await fs.rm(localPath).catch(() => { });
            }, 1000);

        }catch(error: any){
            logger.error(`[Worker #${process.pid}] Cloud Upload Job ${jobId} failed: ${error.message}`);
            this.sendMessage({
                status: 'failed',
                jobId,
                timestep,
                error: error.message
            });
        }
    }
};

BaseWorker.start(BlockStorageServerUpload);
