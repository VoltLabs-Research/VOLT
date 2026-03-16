import { createHash } from 'node:crypto';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import { getTrajectoryRasterPreviewsPrefix } from '@modules/raster/utilities/raster-storage-paths';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

interface ObjectListResponse {
    keys: string[];
};

@injectable()
export default class GetTrajectoryPreviewUseCase implements IUseCase<GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ){}

    async execute(input: GetTrajectoryPreviewInputDTO): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
        }

        if (trajectory.props.teamCluster) {
            const preview = await this.getRemotePreview(trajectory.props.teamCluster, trajectoryId);
            if (preview) {
                return Result.ok(preview);
            }

            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404));
        }

        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);

        // Find the first available preview PNG
        for await (const key of this.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
            if (key.endsWith('.png')) {
                try {
                    const buffer = await this.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, key);
                    return Result.ok(this.createPreviewOutput(buffer));
                } catch {
                    // Continue to next preview if this one fails
                    continue;
                }
            }
        }

        return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404));
    }

    private async getRemotePreview(
        teamClusterId: string,
        trajectoryId: string
    ): Promise<GetTrajectoryPreviewOutputDTO | null> {
        const prefix = getTrajectoryRasterPreviewsPrefix(trajectoryId);
        const result = await this.teamClusterDaemonClient.command<ObjectListResponse>(teamClusterId, 'object.list', {
            bucket: SYS_BUCKETS.RASTERIZER,
            prefix
        });

        const previewKey = result.keys
            .filter((key) => key.endsWith('.png'))
            .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0];

        if (!previewKey) {
            return null;
        }

        const stream = await this.teamClusterDaemonClient.commandStream(teamClusterId, 'object.get', {
            bucket: SYS_BUCKETS.RASTERIZER,
            objectKey: previewKey
        });
        const buffer = await this.readStream(stream);

        return this.createPreviewOutput(buffer);
    }

    private createPreviewOutput(buffer: Buffer): GetTrajectoryPreviewOutputDTO {
        const etag = `"${createHash('sha256').update(buffer).digest('hex')}"`;

        return {
            base64: `data:image/png;base64,${buffer.toString('base64')}`,
            etag
        };
    }

    private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }
};
