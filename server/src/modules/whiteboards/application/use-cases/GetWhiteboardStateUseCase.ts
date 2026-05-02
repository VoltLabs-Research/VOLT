import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardStateDTO';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Readable } from 'node:stream';
import { inject } from 'tsyringe';

/** Empty scene returned for whiteboards that have never been saved. */
const EMPTY_SCENE_JSON = JSON.stringify({ revision: 0, elements: [], appState: {} });

@Singleton()
export class GetWhiteboardStateUseCase implements IUseCase<GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: GetWhiteboardStateInputDTO): Promise<Result<GetWhiteboardStateOutputDTO, ApplicationError>> {
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

            const key = whiteboard.props.payloadKey || `${input.teamId}/${input.whiteboardId}/state.json`;
            const stateExists = await this.storageService.exists(SYS_BUCKETS.WHITEBOARDS, key);

            if (!stateExists) {
                const stream = Readable.from(Buffer.from(EMPTY_SCENE_JSON));
                return Result.ok({ stream });
            }

            const stream = await this.storageService.getStream(SYS_BUCKETS.WHITEBOARDS, key);
            return Result.ok({ stream });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to load whiteboard state',
                500
            ));
        }
    }
}
