import { createHash } from 'node:crypto';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { getTrajectoryRasterPreviewsPrefix } from '@modules/raster/utilities/raster-storage-paths';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

import { inject, injectable } from 'tsyringe';

import TrajectoryRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class GetTrajectoryPreviewUseCase implements IUseCase<GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO, ApplicationError> {
    constructor(
        
        private readonly trajectoryRepository: TrajectoryRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ){}

    async execute(input: GetTrajectoryPreviewInputDTO): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
        }

        const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);

        if (storageClusterId) {
            const preview = await this.getRemotePreview(storageClusterId, trajectoryId);
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
        const keys: string[] = [];
        for await (const key of this.objectGatewayClient.listAll(teamClusterId, {
            bucket: SYS_BUCKETS.RASTERIZER,
            prefix
        })) {
            if (key.endsWith('.png')) {
                keys.push(key);
            }
        }

        const previewKey = keys
            .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))[0];

        if (!previewKey) {
            return null;
        }

        const buffer = await this.objectGatewayClient.getBuffer(
            teamClusterId,
            SYS_BUCKETS.RASTERIZER,
            previewKey
        );

        return this.createPreviewOutput(buffer);
    }

    private createPreviewOutput(buffer: Buffer): GetTrajectoryPreviewOutputDTO {
        const etag = `"${createHash('sha256').update(buffer).digest('hex')}"`;

        return {
            base64: `data:image/png;base64,${buffer.toString('base64')}`,
            etag
        };
    }
};
