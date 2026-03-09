import { SYS_BUCKETS } from '@core/config/minio';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { hasStringProperty, isRecord } from '@shared/infrastructure/utilities/type-guards';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';

import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';

import type { Job as BullJob } from 'bullmq';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type { QueueJobData } from '@modules/jobs/infrastructure/services/ProcessingQueueShared';

interface CloudUploadJobFile {
    frameFilePath: string;
};

interface CloudUploadJobMetadata {
    trajectoryId: string;
    teamClusterId?: string;
    timestep: number;
    file: CloudUploadJobFile;
};

interface CloudUploadJobMetadataRecord extends Record<string, unknown> {
    trajectoryId: string;
    teamClusterId?: string;
    timestep: number;
    file: CloudUploadJobFile;
};

@injectable()
export default class CloudUploadProcessor {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async process(job: BullJob<QueueJobData>): Promise<void> {
        logger.info(`@cloud-upload-processor: received job ${job.id}, jobId=${job.data?.jobId}`);

        const { metadata } = job.data;
        const { trajectoryId, teamClusterId, timestep, file } = this.readMetadata(metadata);
        const localPath = file.frameFilePath;

        logger.info(`@cloud-upload-processor: processing trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${localPath}`);

        if (!teamClusterId) {
            throw new Error('Cloud upload requires a team cluster. No local native modules available.');
        }

        await this.uploadDumpToTeamCluster(teamClusterId, trajectoryId, timestep, localPath);
        await this.notifyTeamClusterPreprocess(teamClusterId, trajectoryId, timestep);

        logger.info(`@cloud-upload-processor: completed job ${job.id} trajectoryId=${trajectoryId} timestep=${timestep}`);
    }

    private readMetadata(metadata: unknown): CloudUploadJobMetadata {
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
            teamClusterId: typeof metadataRecord.teamClusterId === 'string'
                ? metadataRecord.teamClusterId
                : undefined,
            timestep: metadataRecord.timestep,
            file: {
                frameFilePath: file.frameFilePath
            }
        };
    }

    private async uploadDumpToTeamCluster(
        teamClusterId: string,
        trajectoryId: string,
        timestep: number,
        localPath: string
    ): Promise<void> {
        const dumpBuffer = await fs.readFile(localPath);
        const compressedDump = zlib.gzipSync(dumpBuffer, {
            level: zlib.constants.Z_BEST_SPEED
        });
        const objectKey = this.dumpStorage.getObjectName(trajectoryId, String(timestep));

        await this.teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/object-upload', {
            method: 'POST',
            body: {
                bucket: SYS_BUCKETS.DUMPS,
                objectKey,
                content: compressedDump.toString('base64'),
                encoding: 'base64',
                metadata: {
                    'Content-Type': 'application/gzip',
                    'Content-Encoding': 'gzip'
                }
            }
        });
    }

    private async notifyTeamClusterPreprocess(
        teamClusterId: string,
        trajectoryId: string,
        timestep: number
    ): Promise<void> {
        const objectKey = this.dumpStorage.getObjectName(trajectoryId, String(timestep));

        await this.teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/native/trajectory/preprocess', {
            method: 'POST',
            body: {
                trajectoryId,
                timestep,
                objectKey
            }
        });
    }
};
