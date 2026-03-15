import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { SaveWhiteboardStateInputDTO, SaveWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/SaveWhiteboardStateDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';

@injectable()
export class SaveWhiteboardStateUseCase implements IUseCase<SaveWhiteboardStateInputDTO, SaveWhiteboardStateOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: SaveWhiteboardStateInputDTO): Promise<Result<SaveWhiteboardStateOutputDTO, ApplicationError>> {
        try {
            if (!input.userId) {
                return Result.fail(ApplicationError.unauthorized(
                    ErrorCodes.AUTHENTICATION_REQUIRED,
                    'Authentication required'
                ));
            }

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

            await this.storageService.upload(
                SYS_BUCKETS.WHITEBOARDS,
                key,
                input.stateBuffer,
                { 'Content-Type': 'application/json' }
            );

            const updates: Partial<WhiteboardProps> = {
                lastEditedBy: input.userId
            };

            await this.whiteboardRepository.updateById(input.whiteboardId, updates);

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to save whiteboard state',
                500
            ));
        }
    }
};
