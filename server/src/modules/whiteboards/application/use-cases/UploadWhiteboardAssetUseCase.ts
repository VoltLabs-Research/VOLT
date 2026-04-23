import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/UploadWhiteboardAssetDTO';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

@Singleton()
export class UploadWhiteboardAssetUseCase implements IUseCase<UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO, ApplicationError> {
    constructor(
        
        private readonly whiteboardRepository: WhiteboardRepository,

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
