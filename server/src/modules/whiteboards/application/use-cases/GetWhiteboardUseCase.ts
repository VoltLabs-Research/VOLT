import { ErrorCodes } from '@core/constants/error-codes';
import type { GetWhiteboardInputDTO, GetWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardDTO';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class GetWhiteboardUseCase implements IUseCase<GetWhiteboardInputDTO, GetWhiteboardOutputDTO, ApplicationError> {
    constructor(
        
        private readonly whiteboardRepository: WhiteboardRepository
    ) {}

    async execute(input: GetWhiteboardInputDTO): Promise<Result<GetWhiteboardOutputDTO, ApplicationError>> {
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

        return Result.ok({
            _id: whiteboard._id,
            title: whiteboard.props.title,
            payloadKey: whiteboard.props.payloadKey,
            thumbnailKey: whiteboard.props.thumbnailKey,
            lastEditedBy: whiteboard.props.lastEditedBy,
            createdAt: whiteboard.props.createdAt,
            updatedAt: whiteboard.props.updatedAt
        });
    }
};
