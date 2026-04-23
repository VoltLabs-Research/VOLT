import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateWhiteboardInputDTO, UpdateWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/UpdateWhiteboardDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class UpdateWhiteboardUseCase implements IUseCase<UpdateWhiteboardInputDTO, UpdateWhiteboardOutputDTO, ApplicationError> {
    constructor(
        
        private readonly whiteboardRepository: WhiteboardRepository
    ) {}

    async execute(input: UpdateWhiteboardInputDTO): Promise<Result<UpdateWhiteboardOutputDTO, ApplicationError>> {
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

        const updates: Partial<WhiteboardProps> = {};

        if (input.title !== undefined) {
            updates.title = input.title;
        }

        updates.lastEditedBy = input.userId;

        const updated = await this.whiteboardRepository.updateById(input.whiteboardId, updates);
        const finalWhiteboard = updated ?? whiteboard;

        return Result.ok({
            _id: finalWhiteboard._id,
            title: finalWhiteboard.props.title,
            updatedAt: finalWhiteboard.props.updatedAt
        });
    }
};
