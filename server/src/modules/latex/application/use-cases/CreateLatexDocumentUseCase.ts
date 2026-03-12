import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CreateLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';

const DEFAULT_DOCUMENT_CONTENT = '';

@injectable()
export class CreateLatexDocumentUseCase implements IUseCase<CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository
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

            const initialContent = input.content ?? DEFAULT_DOCUMENT_CONTENT;

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
                content: initialContent,
                createdBy: input.userId,
                folder: input.folderId ?? null,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return Result.ok({
                _id: document._id,
                title: document.props.title,
                content: document.props.content,
                folder: document.props.folder,
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
