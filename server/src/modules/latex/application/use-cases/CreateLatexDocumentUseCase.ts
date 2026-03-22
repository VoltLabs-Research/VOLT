import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import LatexDocumentCreatedEvent from '@modules/latex/domain/events/LatexDocumentCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type { CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CreateLatexDocumentDTO';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';

const DEFAULT_ENTRYPOINT_NAME = 'main.tex';
const DEFAULT_DOCUMENT_CONTENT = '';

@injectable()
export class CreateLatexDocumentUseCase implements IUseCase<CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateLatexDocumentInputDTO): Promise<Result<CreateLatexDocumentOutputDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Document title is required'
                ));
            }

            if (input.folderId) {
                const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                    input.teamId,
                    input.folderId
                );

                if (!folder) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        'Target LaTeX folder not found'
                    ));
                }
            }

            const document = await this.latexDocumentRepository.create({
                team: input.teamId,
                title,
                createdBy: input.userId,
                lastEditedBy: input.userId,
                folder: input.folderId ?? null,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await this.latexFileRepository.create({
                document: document._id,
                team: input.teamId,
                name: DEFAULT_ENTRYPOINT_NAME,
                path: '',
                content: DEFAULT_DOCUMENT_CONTENT,
                isEntrypoint: true,
                createdBy: input.userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            await this.eventBus.publish(new LatexDocumentCreatedEvent({
                documentId: document._id,
                teamId: input.teamId,
                userId: input.userId,
                documentTitle: document.props.title ?? ''
            }));

            return Result.ok({
                _id: document._id,
                title: document.props.title,
                folder: document.props.folder,
                createdBy: document.props.createdBy,
                lastEditedBy: document.props.lastEditedBy,
                createdAt: document.props.createdAt,
                updatedAt: document.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create LaTeX document',
                500
            ));
        }
    }
};
