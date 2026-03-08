import { registerAllDependencies } from '@core/bootstrap/register-deps';
import { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import Job from '@modules/jobs/domain/entities/Job';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import { hasStringProperty, isRecord } from '@shared/infrastructure/utilities/type-guards';

import 'reflect-metadata';
import { container } from 'tsyringe';

registerAllDependencies();

interface CloudUploadJobFile {
    frameFilePath: string;
};

interface CloudUploadJobMetadata {
    trajectoryId: string;
    timestep: number;
    file: CloudUploadJobFile;
};

interface CloudUploadJobMetadataRecord extends Record<string, unknown> {
    trajectoryId: string;
    timestep: number;
    file: CloudUploadJobFile;
};

const readCloudUploadJobMetadata = (metadata: unknown): CloudUploadJobMetadata => {
    if (!isRecord(metadata) || !hasStringProperty(metadata, 'trajectoryId')) {
        throw new Error('Invalid cloud upload job metadata');
    }

    const metadataRecord = metadata as CloudUploadJobMetadataRecord;
    if (typeof metadataRecord.timestep !== 'number') {
        throw new Error('Invalid cloud upload job metadata');
    }

    const file = metadataRecord.file;
    if (!isRecord(file) || !hasStringProperty(file, 'frameFilePath')) {
        throw new Error('Invalid cloud upload job metadata');
    }

    return {
        trajectoryId: metadataRecord.trajectoryId,
        timestep: metadataRecord.timestep,
        file: {
            frameFilePath: file.frameFilePath
        }
    };
};

class CloudUploadWorker extends BaseWorker<Job> {
    private dumpStorage!: ITrajectoryDumpStorageService;

    protected async setup(): Promise<void> {
        await this.connectDB();
        this.dumpStorage = container.resolve<ITrajectoryDumpStorageService>(TRAJECTORY_TOKENS.TrajectoryDumpStorageService);
    }

    protected async perform(job: Job): Promise<void> {
        const { jobId, metadata } = job.props;
        const { trajectoryId, timestep, file } = readCloudUploadJobMetadata(metadata);
        const localPath = file.frameFilePath;

        try {
            await this.dumpStorage.saveDump(trajectoryId, String(timestep), localPath);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                trajectoryId
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
            this.sendMessage({
                status: 'failed',
                jobId,
                error: errorMessage
            });
            throw error;
        } finally {
            // Keep the file in cache - do not delete after upload
        }
    }
};

BaseWorker.start(CloudUploadWorker);
