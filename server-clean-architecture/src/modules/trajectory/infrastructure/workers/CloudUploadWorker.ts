import 'reflect-metadata';
import '@core/bootstrap/register-deps';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/ITrajectoryDumpStorageService';
import { container } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import fs from 'node:fs/promises';
import Job from '@modules/jobs/domain/entities/Job';

class CloudUploadWorker extends BaseWorker<Job> {
    private dumpStorage!: ITrajectoryDumpStorageService;

    protected async setup(): Promise<void> {
        await this.connectDB();
        this.dumpStorage = container.resolve<ITrajectoryDumpStorageService>(TRAJECTORY_TOKENS.TrajectoryDumpStorageService);
    }

    protected async perform(job: Job): Promise<void> {
        const { jobId, metadata } = job.props;
        const { trajectoryId, timestep, file } = metadata as any;
        const localPath = file.frameFilePath;

        try {
            await this.dumpStorage.saveDump(trajectoryId, String(timestep), localPath);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                trajectoryId
            });
        } catch (error: any) {
            this.sendMessage({
                status: 'failed',
                jobId,
                error: error.message
            });
            throw error;
        } finally {
            // Clean up the local cached file after upload
            setTimeout(async () => {
                await fs.rm(localPath).catch(() => { });
            }, 5000);
        }
    }
}

BaseWorker.start(CloudUploadWorker);
