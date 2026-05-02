import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardDTO';
import WhiteboardDeletedEvent from '@modules/whiteboards/domain/events/WhiteboardDeletedEvent';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteWhiteboardUseCase implements IUseCase<DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteWhiteboardInputDTO): Promise<Result<DeleteWhiteboardOutputDTO, ApplicationError>> {
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

            await this.whiteboardRepository.deleteById(input.whiteboardId);

            const prefix = `${input.teamId}/${input.whiteboardId}/`;
            try {
                await this.storageService.deleteByPrefix(SYS_BUCKETS.WHITEBOARDS, prefix);
            } catch {
                // Storage cleanup is best-effort
            }

            await this.eventBus.publish(new WhiteboardDeletedEvent({
                whiteboardId: input.whiteboardId,
                teamId: input.teamId,
                userId: input.userId,
                whiteboardTitle: whiteboard.props.title ?? ''
            }));

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete whiteboard',
                500
            ));
        }
    }
}
