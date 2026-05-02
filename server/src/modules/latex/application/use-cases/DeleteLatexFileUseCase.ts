import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteLatexFileInputDTO, DeleteLatexFileOutputDTO } from '@modules/latex/application/dtos/DeleteLatexFileDTO';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Deletes a LatexFile.
 *
 * Refuses to delete the entrypoint file — at least one file must remain
 * as the compilation root. The user must set a different entrypoint first.
 */
@Singleton()
export class DeleteLatexFileUseCase implements IUseCase<DeleteLatexFileInputDTO, DeleteLatexFileOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexFileRepository: LatexFileRepository
    ) {}

    async execute(input: DeleteLatexFileInputDTO): Promise<Result<DeleteLatexFileOutputDTO, ApplicationError>> {
        try {
            const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
                input.teamId,
                input.documentId
            );

            if (!document) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            const file = await this.latexFileRepository.findByDocumentAndFileId(
                input.documentId,
                input.fileId
            );

            if (!file) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.LATEX_FILE_NOT_FOUND,
                    'LaTeX file not found'
                ));
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

            return Result.ok(undefined as unknown as void);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete LaTeX file',
                500
            ));
        }
    }
}
