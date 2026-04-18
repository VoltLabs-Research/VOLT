import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { isRetryableTeamClusterTransportError } from '@modules/team-cluster/infrastructure/services/TeamClusterTransportError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WorkerFailureError, createWorkerFailureEnvelope } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import logger from '@shared/infrastructure/logger';
import pRetry from 'p-retry';
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

const RETRY_OPTIONS = {
    maxAttempts: 3,
    baseDelayMs: 500
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
        try {
            await pRetry(operation, {
                retries: RETRY_OPTIONS.maxAttempts - 1,
                factor: 1,
                minTimeout: RETRY_OPTIONS.baseDelayMs,
                maxTimeout: RETRY_OPTIONS.baseDelayMs * RETRY_OPTIONS.maxAttempts,
                shouldRetry: ({ error }) => isRetryableTeamClusterTransportError(error),
                onFailedAttempt: ({ attemptNumber }) => {
                    logger.warn(`\`@cloud-upload-processor: transient daemon transport failure during ${commandName}\` attempt=${attemptNumber} commandName=${commandName} maxAttempts=${RETRY_OPTIONS.maxAttempts} teamClusterId=${task.teamClusterId}`);
                }
            });
        } catch (error) {
            if (!isRetryableTeamClusterTransportError(error)) {
                throw error;
            }

            throw new WorkerFailureError(createWorkerFailureEnvelope({
                code: ErrorCodes.TRAJECTORY_DAEMON_TRANSPORT_FAILED,
                details: error instanceof Error
                    ? error.message
                    : 'Trajectory daemon transport retries exhausted'
            }));
        }
    }
}
