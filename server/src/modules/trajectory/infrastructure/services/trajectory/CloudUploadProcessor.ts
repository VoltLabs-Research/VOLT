import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRetryableTeamClusterTransportError } from '@modules/team-cluster/infrastructure/services/TeamClusterTransportError';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkerFailureError, createWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';   

import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';

interface CloudUploadTask {
    trajectoryId: string;
    teamId: string;
    teamClusterId?: string;
    trajectoryName?: string;
    timestep: number;
    frameFilePath: string;
};

interface TeamClusterCommandClient {
    command(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<unknown>;
};

interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
};

const RETRY_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 500
};

const wait = async (delayMs: number): Promise<void> => {
    await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });
};

@injectable()
export default class CloudUploadProcessor {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterCommandClient
    ) {}

    async process(task: CloudUploadTask): Promise<void> {
        const {
            trajectoryId,
            teamId,
            teamClusterId,
            trajectoryName,
            timestep,
            frameFilePath
        } = task;

        logger.info(`@cloud-upload-processor: uploading frame for GLB preprocess trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${frameFilePath}`);

        if (!teamClusterId) {
            throw new Error('Cloud upload requires a team cluster. No local native modules available.');
        }

        await this.executeWithTransportRetry(
            task,
            'object.upload',
            () => this.uploadDumpToTeamCluster(teamClusterId, trajectoryId, timestep, frameFilePath)
        );
        await this.executeWithTransportRetry(
            task,
            'trajectory.native.preprocess',
            () => this.requestTeamClusterGlbPreprocess(teamClusterId, trajectoryId, teamId, timestep, trajectoryName)
        );

        logger.info(`@cloud-upload-processor: uploaded frame and requested GLB preprocess trajectoryId=${trajectoryId} timestep=${timestep}`);
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

        await this.teamClusterDaemonClient.command(teamClusterId, 'object.upload', {
            bucket: SYS_BUCKETS.DUMPS,
            objectKey,
            content: compressedDump.toString('base64'),
            encoding: 'base64',
            metadata: {
                'Content-Type': 'application/gzip',
                'Content-Encoding': 'gzip'
            }
        });
    }

    private async requestTeamClusterGlbPreprocess(
        teamClusterId: string,
        trajectoryId: string,
        teamId: string,
        timestep: number,
        trajectoryName?: string
    ): Promise<void> {
        const objectKey = this.dumpStorage.getObjectName(trajectoryId, String(timestep));

        await this.teamClusterDaemonClient.command(teamClusterId, 'trajectory.native.preprocess', {
            trajectoryId,
            teamId,
            timestep,
            objectKey,
            ...(trajectoryName ? { trajectoryName } : {})
        });
    }

    /** Retries transient daemon transport failures before surfacing a terminal trajectory failure. */
    private async executeWithTransportRetry(
        task: CloudUploadTask,
        commandName: string,
        operation: () => Promise<void>
    ): Promise<void> {
        let lastError: unknown;

        for (let attempt = 1; attempt <= RETRY_OPTIONS.maxAttempts; attempt += 1) {
            try {
                await operation();
                return;
            } catch (error) {
                lastError = error;

                if (!isRetryableTeamClusterTransportError(error)) {
                    throw error;
                }

                logger.warn({
                    attempt,
                    commandName,
                    maxAttempts: RETRY_OPTIONS.maxAttempts,
                    teamClusterId: task.teamClusterId,
                    timestep: task.timestep,
                    trajectoryId: task.trajectoryId
                }, `@cloud-upload-processor: transient daemon transport failure during ${commandName}`);

                if (attempt === RETRY_OPTIONS.maxAttempts) {
                    break;
                }

                await wait(RETRY_OPTIONS.baseDelayMs * attempt);
            }
        }

        throw new WorkerFailureError(createWorkerFailureEnvelope({
            code: ErrorCodes.TRAJECTORY_DAEMON_TRANSPORT_FAILED,
            details: lastError instanceof Error
                ? lastError.message
                : 'Trajectory daemon transport retries exhausted'
        }));
    }
};
