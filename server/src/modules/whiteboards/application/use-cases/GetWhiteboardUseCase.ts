import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetWhiteboardInputDTO, GetWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetWhiteboardUseCase implements IUseCase<GetWhiteboardInputDTO, GetWhiteboardOutputDTO> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository
    ) {}

    async execute(input: GetWhiteboardInputDTO): Promise<GetWhiteboardOutputDTO> {
        const whiteboard = await this.whiteboardRepository.findByTeamAndWhiteboardId(
            input.teamId,
            input.whiteboardId
        );

        if (!whiteboard) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'Whiteboard not found'
            );
        }

        return {
            _id: whiteboard._id,
            title: whiteboard.props.title,
            payloadKey: whiteboard.props.payloadKey,
            thumbnailKey: whiteboard.props.thumbnailKey,
            lastEditedBy: whiteboard.props.lastEditedBy,
            createdAt: whiteboard.props.createdAt,
            updatedAt: whiteboard.props.updatedAt
        };
    }
}
