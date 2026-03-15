import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardFolderDTO';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';

@injectable()
export class DeleteWhiteboardFolderUseCase implements IUseCase<DeleteWhiteboardFolderInputDTO, DeleteWhiteboardFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardFolderRepository)
        private readonly whiteboardFolderRepository: IWhiteboardFolderRepository,
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository)
        private readonly whiteboardRepository: IWhiteboardRepository,
        @inject(DeleteWhiteboardUseCase)
        private readonly deleteWhiteboardUseCase: DeleteWhiteboardUseCase
    ) {}

    async execute(input: DeleteWhiteboardFolderInputDTO): Promise<Result<DeleteWhiteboardFolderOutputDTO, ApplicationError>> {
        try {
            if (!input.userId) {
                return Result.fail(ApplicationError.unauthorized(
                    ErrorCodes.AUTHENTICATION_REQUIRED,
                    'Authentication required'
                ));
            }

            const folder = await this.whiteboardFolderRepository.findByTeamAndFolderId(input.teamId, input.folderId);

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard folder not found'
                ));
            }

            await this.deleteFolderTree(input.teamId, input.folderId, input.userId);

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete Whiteboard folder',
                500
            ));
        }
    }

    private async deleteFolderTree(teamId: string, folderId: string, userId: string): Promise<void> {
        const subfolders = await this.whiteboardFolderRepository.findAll({
            filter: {
                team: teamId,
                parent: folderId
            }
        });

        for (const subfolder of subfolders.data) {
            await this.deleteFolderTree(teamId, subfolder._id, userId);
        }

        const whiteboards = await this.whiteboardRepository.export({
            filter: {
                team: teamId,
                folder: folderId
            }
        });

        for (const whiteboard of whiteboards) {
            const result = await this.deleteWhiteboardUseCase.execute({
                teamId,
                whiteboardId: whiteboard._id,
                userId
            });

            if (!result.success) {
                throw result.error;
            }
        }

        await this.whiteboardFolderRepository.deleteById(folderId);
    }
}
