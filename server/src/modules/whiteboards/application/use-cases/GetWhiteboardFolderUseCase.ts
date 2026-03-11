import { ErrorCodes } from '@core/constants/error-codes';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type {
    GetWhiteboardFolderInputDTO,
    GetWhiteboardFolderOutputDTO
} from '@modules/whiteboards/application/dtos/GetWhiteboardFolderDTO';

@injectable()
export class GetWhiteboardFolderUseCase implements IUseCase<GetWhiteboardFolderInputDTO, GetWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository
    ) {}

    async execute(input: GetWhiteboardFolderInputDTO): Promise<Result<GetWhiteboardFolderOutputDTO, ApplicationError>> {
        try {
            const folder = await this.whiteboardFolderRepository.findByTeamAndFolderId(input.teamId, input.folderId);

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard folder not found'
                ));
            }

            return Result.ok({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            });
        } catch {
            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to fetch whiteboard folder',
                500
            ));
        }
    }
};
