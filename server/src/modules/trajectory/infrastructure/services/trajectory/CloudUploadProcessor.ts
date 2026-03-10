import { SYS_BUCKETS } from '@core/config/minio';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import { injectable, inject } from 'tsyringe';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';   

import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';

interface CloudUploadTask {
    trajectoryId: string;
    teamClusterId?: string;
    timestep: number;
    frameFilePath: string;
};

@injectable()
export default class CloudUploadProcessor {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly dumpStorage: ITrajectoryDumpStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async process(task: CloudUploadTask): Promise<void> {
        const { trajectoryId, teamClusterId, timestep, frameFilePath } = task;

        logger.info(`@cloud-upload-processor: processing trajectoryId=${trajectoryId} timestep=${timestep} teamClusterId=${teamClusterId || 'none'} localPath=${frameFilePath}`);

        if (!teamClusterId) {
            throw new Error('Cloud upload requires a team cluster. No local native modules available.');
        }

        await this.uploadDumpToTeamCluster(teamClusterId, trajectoryId, timestep, frameFilePath);
        await this.notifyTeamClusterPreprocess(teamClusterId, trajectoryId, timestep);

        logger.info(`@cloud-upload-processor: completed trajectoryId=${trajectoryId} timestep=${timestep}`);
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
