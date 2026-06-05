import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import {
    createDownloadStreamResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { Readable } from 'node:stream';

/** Exports the entrypoint LatexFile as a downloadable `.tex` file. */
@Singleton()
export class ExportLatexDocumentTexUseCase implements IUseCase<ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: ExportLatexDocumentInputDTO): Promise<Result<ExportLatexDocumentOutputDTO, ApplicationError>> {
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

            const files = await this.latexFileRepository.findAllByDocument(input.documentId);
            const entrypoint = files.find((file) => file.props.isEntrypoint)
                ?? files.find((file) => file.props.name.toLowerCase().endsWith('.tex'))
                ?? null;

            if (!entrypoint) {
                return Result.fail(new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    'No .tex file was found in this document. Add or select a .tex file to export.',
                    422
                ));
            }

            const safeName = sanitizeDownloadName(document.props.title, 'document');
            const filename = `${safeName}.tex`;

            const output = createDownloadStreamResponse({
                stream: Readable.from([entrypoint.props.content]),
                contentType: 'application/x-tex; charset=utf-8',
                filename,
                cacheControl: 'no-cache'
            });

            return Result.ok(output);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to export LaTeX document',
                500
            ));
        }
    }
}
