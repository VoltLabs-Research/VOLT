import { createHash } from 'node:crypto';

import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { resolveTrajectoryStorageClusterId } from '@modules/team-cluster/application/utilities/cluster-location';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { getTrajectoryRasterPreviewsPrefix } from '@modules/raster/utilities/raster-storage-paths';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

import type { GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

interface GetPublicCanvasPreviewInput {
    trajectoryId: string;
    userId?: string;
};

@injectable()
export class GetPublicCanvasPreviewUseCase implements IUseCase<
    GetPublicCanvasPreviewInput,
    GetTrajectoryPreviewOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient)
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: GetPublicCanvasPreviewInput): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(
                input.trajectoryId,
                input.userId
            );

            const storageClusterId = resolveTrajectoryStorageClusterId(trajectory.props);

            if (storageClusterId) {
                const preview = await this.getRemotePreview(storageClusterId, input.trajectoryId);
                if (preview) {
                    return Result.ok(preview);
                }

                return Result.fail(new ApplicationError(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'No preview available for this trajectory',
                    404
                ));
            }

            const prefix = getTrajectoryRasterPreviewsPrefix(input.trajectoryId);
            for await (const key of this.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
                if (key.endsWith('.png')) {
                    try {
                        const buffer = await this.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, key);
                        return Result.ok(this.createPreviewOutput(buffer));
                    } catch {
                        continue;
                    }
                }
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'No preview available for this trajectory',
                404
            ));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
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
