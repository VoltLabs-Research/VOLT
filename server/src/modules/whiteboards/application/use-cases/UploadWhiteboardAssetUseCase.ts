import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/UploadWhiteboardAssetDTO';

@injectable()
export class UploadWhiteboardAssetUseCase implements IUseCase<UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: UploadWhiteboardAssetInputDTO): Promise<Result<UploadWhiteboardAssetOutputDTO, ApplicationError>> {
        try {
            const whiteboard = await this.whiteboardRepository.findByTeamAndWhiteboardId(
                input.teamId,
                input.whiteboardId
            );

            if (!whiteboard) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard not found'
                ));
            }

            const assetId = uuidv4();
            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${assetId}`;

            await this.storageService.upload(
                SYS_BUCKETS.WHITEBOARDS,
                objectKey,
                input.buffer,
                { 'Content-Type': input.mimetype }
            );

            return Result.ok({ assetId });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to upload whiteboard asset',
                500
            ));
        }
    }
};
