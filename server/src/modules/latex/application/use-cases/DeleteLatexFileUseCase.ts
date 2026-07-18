import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteLatexFileInputDTO, DeleteLatexFileOutputDTO } from '@modules/latex/application/dtos/DeleteLatexFileDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * Deletes a LatexFile.
 *
 * Refuses to delete the entrypoint file — at least one file must remain
 * as the compilation root. The user must set a different entrypoint first.
 */
@Singleton()
export class DeleteLatexFileUseCase implements IUseCase<DeleteLatexFileInputDTO, DeleteLatexFileOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: DeleteLatexFileInputDTO): Promise<DeleteLatexFileOutputDTO> {
        const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
            input.teamId,
            input.documentId
        );

        if (!document) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }

        const file = await this.latexFileRepository.findByDocumentAndFileId(
            input.documentId,
            input.fileId
        );

        if (!file) {
            throw ApplicationError.notFound(
                ErrorCodes.LATEX_FILE_NOT_FOUND,
                'LaTeX file not found'
            );
        }

        if (file.props.isEntrypoint) {
            const remainingFiles = (await this.latexFileRepository.findAllByDocument(input.documentId))
                .filter((currentFile) => currentFile._id !== input.fileId);

            if (remainingFiles.length > 0) {
                const nextEntrypoint = remainingFiles.find((currentFile) =>
                    currentFile.props.name.toLowerCase().endsWith('.tex')
                ) ?? remainingFiles[0];

                await this.latexFileRepository.clearEntrypointForDocument(input.documentId);
                await this.latexFileRepository.updateById(nextEntrypoint._id, {
                    isEntrypoint: true,
                    updatedAt: new Date()
                });
            }
        }

        await this.latexFileRepository.deleteById(input.fileId);
    }
}
