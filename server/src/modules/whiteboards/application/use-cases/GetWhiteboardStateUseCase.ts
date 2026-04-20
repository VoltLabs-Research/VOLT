import { Readable } from 'node:stream';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardStateDTO';

/** Empty scene returned for whiteboards that have never been saved. */
const EMPTY_SCENE_JSON = JSON.stringify({ revision: 0, elements: [], appState: {} });

@injectable()
export class GetWhiteboardStateUseCase implements IUseCase<GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,

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
};
