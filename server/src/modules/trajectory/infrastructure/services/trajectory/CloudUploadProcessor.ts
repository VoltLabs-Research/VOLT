import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRetryableTeamClusterTransportError } from '@modules/team-cluster/infrastructure/services/TeamClusterTransportError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkerFailureError, createWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';

interface CloudUploadTask {
    trajectoryId: string;
    teamId: string;
    teamClusterId?: string;
    trajectoryName?: string;
    timestep: number;
    frameFilePath: string;
    objectKey: string;
    contentType?: string;
    contentEncoding?: string;
}

interface TeamClusterObjectStoreClient {
    putStream(teamClusterId: string, request: {
        bucket: string;
        objectKey: string;
        stream: Readable;
        contentLength: number;
        contentType?: string;
        contentEncoding?: string;
        metadata?: Record<string, string>;
    }): Promise<void>;
}

interface RetryOptions {
    maxAttempts: number;
    baseDelayMs: number;
}

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
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectStoreClient
    ) {}

    async process(task: CloudUploadTask): Promise<void> {
        const {
            trajectoryId,
            teamClusterId,
            timestep,
            frameFilePath
        } = task;

        logger.info(`@cloud-upload-processor: uploading compressed frame trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${frameFilePath}`);

        if (!teamClusterId) {
            throw new Error('Cloud upload requires a team cluster. No local native modules available.');
        }

        await this.executeWithTransportRetry(
            task,
            'object-gateway.put',
            () => this.uploadDumpToTeamCluster(task)
        );
    }

    private async uploadDumpToTeamCluster(task: CloudUploadTask): Promise<void> {
        if (!task.teamClusterId) {
            throw new Error('Cloud upload requires a team cluster.');
        }

        const stat = await fs.stat(task.frameFilePath);
        await this.objectGatewayClient.putStream(task.teamClusterId, {
            bucket: SYS_BUCKETS.DUMPS,
            objectKey: task.objectKey,
            stream: createReadStream(task.frameFilePath),
            contentLength: stat.size,
            contentType: task.contentType,
            contentEncoding: task.contentEncoding
        });
    }

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
}
