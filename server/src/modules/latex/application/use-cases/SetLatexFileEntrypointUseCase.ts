import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { SetLatexFileEntrypointInputDTO, SetLatexFileEntrypointOutputDTO } from '@modules/latex/application/dtos/SetLatexFileEntrypointDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';

/**
 * Sets the entrypoint for a LaTeX document.
 *
 * Atomically clears the existing entrypoint flag from all other files
 * before marking the target file as the new entrypoint. This guarantees
 * exactly one entrypoint per document at all times.
 */
@injectable()
export class SetLatexFileEntrypointUseCase implements IUseCase<SetLatexFileEntrypointInputDTO, SetLatexFileEntrypointOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: SetLatexFileEntrypointInputDTO): Promise<Result<SetLatexFileEntrypointOutputDTO, ApplicationError>> {
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

            await this.latexFileRepository.clearEntrypointForDocument(input.documentId);
            const updated = await this.latexFileRepository.updateById(input.fileId, {
                isEntrypoint: true,
                updatedAt: new Date()
            });

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.LATEX_FILE_NOT_FOUND,
                    'LaTeX file not found after update'
                ));
            }

            return Result.ok({
                _id: updated._id,
                documentId: updated.props.document,
                name: updated.props.name,
                path: updated.props.path,
                content: updated.props.content,
                isEntrypoint: updated.props.isEntrypoint,
                createdAt: updated.props.createdAt,
                updatedAt: updated.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to set LaTeX file entrypoint',
                500
            ));
        }
    }
};
