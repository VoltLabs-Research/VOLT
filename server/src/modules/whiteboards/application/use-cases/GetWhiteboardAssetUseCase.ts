import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetWhiteboardAssetInputDTO, GetWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class GetWhiteboardAssetUseCase implements IUseCase<GetWhiteboardAssetInputDTO, GetWhiteboardAssetOutputDTO, ApplicationError> {
    constructor(
        
        private readonly whiteboardRepository: WhiteboardRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: GetWhiteboardAssetInputDTO): Promise<Result<GetWhiteboardAssetOutputDTO, ApplicationError>> {
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

            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${input.assetId}`;
            let mimetype: string | undefined;

            try {
                const stat = await this.storageService.getStat(SYS_BUCKETS.WHITEBOARDS, objectKey);
                mimetype = stat.mimetype;
            } catch {
                // stat is best-effort
            }

            const stream = await this.storageService.getStream(SYS_BUCKETS.WHITEBOARDS, objectKey);

            return Result.ok({ stream, mimetype });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to get whiteboard asset',
                500
            ));
        }
    }
};
