import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type {
    DeleteLatexFolderInputDTO,
    DeleteLatexFolderOutputDTO
} from '@modules/latex/application/dtos/DeleteLatexFolderDTO';

@injectable()
export class DeleteLatexFolderUseCase implements IUseCase<DeleteLatexFolderInputDTO, DeleteLatexFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository,

        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: DeleteLatexFolderInputDTO): Promise<Result<DeleteLatexFolderOutputDTO, ApplicationError>> {
        try {
            const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                input.teamId,
                input.folderId
            );

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX folder not found'
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
                'Failed to delete LaTeX folder',
                500
            ));
        }
    }

    /**
     * Recursively deletes a folder and all its descendant folders and documents.
     * Documents are unlinked (folder set to null) rather than deleted, preserving
     * document content while removing the folder structure.
     */
    private async deleteRecursive(teamId: string, folderId: string): Promise<void> {
        const subfolders = await this.latexFolderRepository.findAll({
            filter: { team: teamId, parent: folderId }
        });

        for (const subfolder of subfolders.data) {
            await this.deleteRecursive(teamId, subfolder._id);
        }

        await this.latexDocumentRepository.updateMany(
            { team: teamId, folder: folderId },
            { folder: null } as never
        );

        await this.latexFolderRepository.deleteById(folderId);
    }
};
