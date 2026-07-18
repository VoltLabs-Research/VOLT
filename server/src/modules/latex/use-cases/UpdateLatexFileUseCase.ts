import type { ILatexFileRepository } from '@modules/latex/ports/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateLatexFileInputDTO, UpdateLatexFileOutputDTO } from '@modules/latex/dtos/UpdateLatexFileDTO';
import LatexFileContentUpdatedEvent from '@modules/latex/events/LatexFileContentUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class UpdateLatexFileUseCase implements IUseCase<UpdateLatexFileInputDTO, UpdateLatexFileOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: UpdateLatexFileInputDTO): Promise<UpdateLatexFileOutputDTO> {
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

        const existing = await this.latexFileRepository.findByDocumentAndFileId(
            input.documentId,
            input.fileId
        );

        if (!existing) {
            throw ApplicationError.notFound(
                ErrorCodes.LATEX_FILE_NOT_FOUND,
                'LaTeX file not found'
            );
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
            throw ApplicationError.notFound(
                ErrorCodes.LATEX_FILE_NOT_FOUND,
                'LaTeX file not found'
            );
        }

        if (input.source === 'ai' && input.content !== undefined) {
            await this.eventBus.publish(new LatexFileContentUpdatedEvent({
                documentId: input.documentId,
                teamId: input.teamId,
                fileId: input.fileId,
                content: input.content
            }));
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
