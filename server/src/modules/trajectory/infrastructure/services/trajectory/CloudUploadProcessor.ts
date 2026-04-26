import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { isRetryableTeamClusterTransportError } from '@modules/cluster/infrastructure/services/TeamClusterTransportError';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { createWorkerFailureEnvelope, getWorkerFailureErrorMessage } from '@shared/infrastructure/workers/WorkerFailureEnvelope';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';

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

@Singleton()
export default class CloudUploadProcessor {
    constructor(
        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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

        try {
            await this.uploadDumpToTeamCluster(task);
        } catch (error) {
            if (!isRetryableTeamClusterTransportError(error)) {
                throw error;
            }

            const failure = createWorkerFailureEnvelope({
                code: ErrorCodes.TRAJECTORY_DAEMON_TRANSPORT_FAILED,
                details: error instanceof Error
                    ? error.message
                    : 'Trajectory daemon transport failed'
            });

            throw new ApplicationError(
                failure.code,
                getWorkerFailureErrorMessage(failure),
                { details: { failure } }
            );
        }
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
}
