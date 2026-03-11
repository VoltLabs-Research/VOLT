import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type {
    CreateWhiteboardFolderInputDTO,
    CreateWhiteboardFolderOutputDTO
} from '@modules/whiteboards/application/dtos/CreateWhiteboardFolderDTO';

@injectable()
export class CreateWhiteboardFolderUseCase implements IUseCase<CreateWhiteboardFolderInputDTO, CreateWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {}

    async execute(input: CreateWhiteboardFolderInputDTO): Promise<Result<CreateWhiteboardFolderOutputDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const parentId = input.parentId ?? null;

            const folder = await this.whiteboardFolderRepository.create({
                team: input.teamId,
                createdBy: input.userId,
                title,
                parent: parentId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return Result.ok({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create whiteboard folder',
                500
            ));
        }
    }
};
