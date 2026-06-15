import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateLatexFileInputDTO, UpdateLatexFileOutputDTO } from '@modules/latex/application/dtos/UpdateLatexFileDTO';
import LatexFileContentUpdatedEvent from '@modules/latex/domain/events/LatexFileContentUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class UpdateLatexFileUseCase implements IUseCase<UpdateLatexFileInputDTO, UpdateLatexFileOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: UpdateLatexFileInputDTO): Promise<Result<UpdateLatexFileOutputDTO, ApplicationError>> {
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

            const existing = await this.latexFileRepository.findByDocumentAndFileId(
                input.documentId,
                input.fileId
            );

            if (!existing) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.LATEX_FILE_NOT_FOUND,
                    'LaTeX file not found'
                ));
            }

            const patch: Record<string, unknown> = { updatedAt: new Date() };

            if (input.name !== undefined) {
                patch.name = input.name.trim();
            }

            if (input.path !== undefined) {
                patch.path = input.path;
            }

            if (input.content !== undefined) {
                patch.content = input.content;
            }

            const updated = await this.latexFileRepository.updateById(input.fileId, patch);

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.LATEX_FILE_NOT_FOUND,
                    'LaTeX file not found'
                ));
            }

            // AI-authored content edits broadcast into any open editing session
            // so collaborators see the change live. Editor/HTTP/auto-save writes
            // (source omitted/'editor') already deliver their own live updates,
            // so they must NOT publish — that would echo back to the editor.
            if (input.source === 'ai' && input.content !== undefined) {
                await this.eventBus.publish(new LatexFileContentUpdatedEvent({
                    documentId: input.documentId,
                    teamId: input.teamId,
                    fileId: input.fileId,
                    content: input.content
                }));
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

            // Let the global error middleware normalize unknown errors (e.g. a Mongoose CastError
            // from a malformed id maps to 400, not a blanket 500).
            throw error;
        }
    }
}
