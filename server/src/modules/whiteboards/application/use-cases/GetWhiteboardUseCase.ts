import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { GetWhiteboardInputDTO, GetWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardDTO';

@injectable()
export class GetWhiteboardUseCase implements IUseCase<GetWhiteboardInputDTO, GetWhiteboardOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository
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
