import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type {
    DeleteWhiteboardFolderInputDTO,
    DeleteWhiteboardFolderOutputDTO
} from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';

@injectable()
export class DeleteWhiteboardFolderUseCase implements IUseCase<DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository,

        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository
    ) {}

    async execute(input: DeleteWhiteboardFolderInputDTO): Promise<Result<DeleteWhiteboardFolderOutputDTO, ApplicationError>> {
        try {
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

            await this.deleteRecursive(input.teamId, input.folderId);

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete whiteboard folder',
                500
            ));
        }
    }

    /**
     * Recursively deletes a folder and all its descendant folders.
     * Whiteboards inside the folder are unlinked (folder set to null),
     * preserving their content.
     */
    private async deleteRecursive(teamId: string, folderId: string): Promise<void> {
        const subfolders = await this.whiteboardFolderRepository.findAll({
            filter: { team: teamId, parent: folderId }
        });

        for (const subfolder of subfolders.data) {
            await this.deleteRecursive(teamId, subfolder._id);
        }

        await this.whiteboardRepository.updateMany(
            { team: teamId, folder: folderId },
            { folder: null } as never
        );

        await this.whiteboardFolderRepository.deleteById(folderId);
    }
};
