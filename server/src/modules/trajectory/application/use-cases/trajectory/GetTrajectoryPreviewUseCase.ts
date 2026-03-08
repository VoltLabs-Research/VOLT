import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO } from '@modules/trajectory/application/dtos/trajectory/GetTrajectoryPreviewDTO';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export default class GetTrajectoryPreviewUseCase implements IUseCase<GetTrajectoryPreviewInputDTO, GetTrajectoryPreviewOutputDTO, ApplicationError> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ){}

    async execute(input: GetTrajectoryPreviewInputDTO): Promise<Result<GetTrajectoryPreviewOutputDTO, ApplicationError>> {
        const { trajectoryId } = input;
        if (!trajectoryId) {
            return Result.fail(new ApplicationError(ErrorCodes.VALIDATION_ID_REQUIRED, 'Trajectory ID is required', 400));
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
};
