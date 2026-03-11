import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type {
    UpdateWhiteboardFolderInputDTO,
    UpdateWhiteboardFolderOutputDTO
} from '@modules/whiteboards/application/dtos/UpdateWhiteboardFolderDTO';

@injectable()
export class UpdateWhiteboardFolderUseCase implements IUseCase<UpdateWhiteboardFolderInputDTO, UpdateWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {}

    async execute(input: UpdateWhiteboardFolderInputDTO): Promise<Result<UpdateWhiteboardFolderOutputDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const folder = await this.whiteboardFolderRepository.findByTeamAndFolderId(
                input.teamId,
                input.folderId
            );

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard folder not found'
                ));
            }

            const updated = await this.whiteboardFolderRepository.updateById(
                input.folderId,
                { title, updatedAt: new Date() }
            );

            const result = updated ?? folder;

            return Result.ok({
                _id: result._id,
                title: result.props.title,
                parent: result.props.parent,
                createdAt: result.props.createdAt,
                updatedAt: result.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update whiteboard folder',
                500
            ));
        }
    }
};
