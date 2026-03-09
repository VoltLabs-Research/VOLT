import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import { getRasterFrameObjectName } from '@modules/raster/utilities/raster-storage-paths';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';

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
        if (!trajectoryId) {
            return Result.fail(new ApplicationError(ErrorCodes.VALIDATION_ID_REQUIRED, 'Trajectory ID is required', 400));
        }

        const trajectory = await this.trajectoryRepository.findById(trajectoryId);
        if (!trajectory) {
            return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'Trajectory not found', 404));
        }

        if (trajectory.props.teamCluster) {
            const preview = await this.getRemotePreview(trajectory.props.teamCluster, trajectoryId, trajectory.props.frames);
            if (preview) {
                return Result.ok(preview);
            }
        }

        const prefix = `trajectory-${trajectoryId}/previews/`;

        // Find the first available preview PNG
        for await (const key of this.storageService.listByPrefix(SYS_BUCKETS.RASTERIZER, prefix)) {
            if (key.endsWith('.png')) {
                try {
                    const buffer = await this.storageService.getBuffer(SYS_BUCKETS.RASTERIZER, key);
                    const etag = `"trajectory-preview-${trajectoryId}"`;
                    const base64 = `data:image/png;base64,${buffer.toString('base64')}`;

                    return Result.ok({ base64, etag });
                } catch (error) {
                    // Continue to next preview if this one fails
                    continue;
                }
            }
        }

        return Result.fail(new ApplicationError(ErrorCodes.RESOURCE_NOT_FOUND, 'No preview available for this trajectory', 404));
    }

    private async getRemotePreview(
        teamClusterId: string,
        trajectoryId: string,
        frames: Array<{ timestep: number; }>
    ): Promise<GetTrajectoryPreviewOutputDTO | null> {
        const sortedFrames = [...frames].sort((left, right) => left.timestep - right.timestep);

        for (const frame of sortedFrames) {
            const objectKey = getRasterFrameObjectName(trajectoryId, frame.timestep);

            try {
                const stream = await this.teamClusterDaemonClient.stream(teamClusterId, `/api/objects/volt-rasterizer`, {
                    query: {
                        objectKey
                    }
                });
                const buffer = await this.readStream(stream);

                return {
                    base64: `data:image/png;base64,${buffer.toString('base64')}`,
                    etag: `"trajectory-preview-${trajectoryId}-${frame.timestep}"`
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }
};
