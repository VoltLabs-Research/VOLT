import type { ILatexFileRepository } from '@modules/latex/ports/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { LatexFileDTO } from '@modules/latex/dtos/LatexFileDTO';
import type { SetLatexFileEntrypointInputDTO } from '@modules/latex/dtos/SetLatexFileEntrypointDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * Sets the entrypoint for a LaTeX document.
 *
 * Atomically clears the existing entrypoint flag from all other files
 * before marking the target file as the new entrypoint. This guarantees
 * exactly one entrypoint per document at all times.
 */
@Singleton()
export class SetLatexFileEntrypointUseCase implements IUseCase<SetLatexFileEntrypointInputDTO, LatexFileDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: SetLatexFileEntrypointInputDTO): Promise<LatexFileDTO> {
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

        await this.latexFileRepository.clearEntrypointForDocument(input.documentId);
        const updated = await this.latexFileRepository.updateById(input.fileId, {
            isEntrypoint: true,
            updatedAt: new Date()
        });

        if (!updated) {
            throw ApplicationError.notFound(
                ErrorCodes.LATEX_FILE_NOT_FOUND,
                'LaTeX file not found after update'
            );
        }

        return {
            _id: updated._id,
            documentId: updated.props.document,
            name: updated.props.name,
            path: updated.props.path,
            content: updated.props.content,
            isEntrypoint: updated.props.isEntrypoint,
            createdAt: updated.props.createdAt,
            updatedAt: updated.props.updatedAt
        };
    }
}
