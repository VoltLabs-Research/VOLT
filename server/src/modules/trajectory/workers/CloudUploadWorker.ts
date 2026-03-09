import 'reflect-metadata';

import { SYS_BUCKETS } from '@core/config/minio';
import { registerAllDependencies } from '@core/bootstrap/register-deps';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { hasStringProperty, isRecord } from '@shared/infrastructure/utilities/type-guards';
import { container } from 'tsyringe';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import mongoConnector from '@shared/infrastructure/utilities/mongo-connector';
import logger from '@shared/infrastructure/logger';

import fs from 'node:fs/promises';
import zlib from 'node:zlib';

import type { SandboxedJob } from 'bullmq';
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

let initialized = false;
let dumpStorage: ITrajectoryDumpStorageService;
let teamClusterDaemonClient: TeamClusterDaemonClient;

const initialize = async (): Promise<void> => {
    if (initialized) return;
    try {
        logger.info(`@cloud-upload-worker #${process.pid} - starting registerAllDependencies`);
        registerAllDependencies();
        logger.info(`@cloud-upload-worker #${process.pid} - registerAllDependencies completed, connecting to mongo`);
        await mongoConnector();
        logger.info(`@cloud-upload-worker #${process.pid} - mongo connected, resolving dependencies`);
        dumpStorage = container.resolve<ITrajectoryDumpStorageService>(TRAJECTORY_TOKENS.TrajectoryDumpStorageService);
        teamClusterDaemonClient = container.resolve<TeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient);
        initialized = true;
        logger.info(`@cloud-upload-worker #${process.pid} - initialized`);
    } catch (error) {
        logger.error(`@cloud-upload-worker #${process.pid} - initialization FAILED: ${error instanceof Error ? error.stack : String(error)}`);
        throw error;
    }
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
        teamClusterId: typeof metadataRecord.teamClusterId === 'string'
            ? metadataRecord.teamClusterId
            : undefined,
        timestep: metadataRecord.timestep,
        file: {
            frameFilePath: file.frameFilePath
        }
    };
};

const uploadDumpToTeamCluster = async (
    teamClusterId: string,
    trajectoryId: string,
    timestep: number,
    localPath: string
): Promise<void> => {
    const dumpBuffer = await fs.readFile(localPath);
    const compressedDump = zlib.gzipSync(dumpBuffer, {
        level: zlib.constants.Z_BEST_SPEED
    });
    const objectKey = dumpStorage.getObjectName(trajectoryId, String(timestep));

    await teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/object-upload', {
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
};

const notifyTeamClusterPreprocess = async (
    teamClusterId: string,
    trajectoryId: string,
    timestep: number
): Promise<void> => {
    const objectKey = dumpStorage.getObjectName(trajectoryId, String(timestep));

    await teamClusterDaemonClient.request(teamClusterId, '/api/orchestration/native/trajectory/preprocess', {
        method: 'POST',
        body: {
            trajectoryId,
            timestep,
            objectKey
        }
    });
};

export default async function (job: SandboxedJob<QueueJobData>): Promise<void> {
    logger.info(`@cloud-upload-worker #${process.pid} - received job ${job.id}, jobId=${job.data?.jobId}`);

    await initialize();

    const { metadata } = job.data;
    const { trajectoryId, teamClusterId, timestep, file } = readCloudUploadJobMetadata(metadata);
    const localPath = file.frameFilePath;

    logger.info(`@cloud-upload-worker #${process.pid} - processing trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${localPath}`);

    if (!teamClusterId) {
        throw new Error('Cloud upload requires a team cluster. No local native modules available.');
    }

    await uploadDumpToTeamCluster(teamClusterId, trajectoryId, timestep, localPath);
    await notifyTeamClusterPreprocess(teamClusterId, trajectoryId, timestep);

    logger.info(`@cloud-upload-worker #${process.pid} - completed job ${job.id} trajectoryId=${trajectoryId} timestep=${timestep}`);
};
