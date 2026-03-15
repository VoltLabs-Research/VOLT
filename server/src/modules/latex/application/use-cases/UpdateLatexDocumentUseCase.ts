import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/UpdateLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';

@injectable()
export class UpdateLatexDocumentUseCase implements IUseCase<UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: UpdateLatexDocumentInputDTO): Promise<Result<UpdateLatexDocumentOutputDTO, ApplicationError>> {
        try {
            const existing = await this.latexDocumentRepository.findByTeamAndDocumentId(
                input.teamId,
                input.documentId
            );

            if (!existing) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            const patch: Record<string, unknown> = {
                updatedAt: new Date(),
                ...(input.userId === undefined ? {} : { lastEditedBy: input.userId })
            };

            if (input.title !== undefined) {
                patch.title = input.title.trim();
            }

            if (input.content !== undefined) {
                patch.content = input.content;
            }

            const updated = await this.latexDocumentRepository.updateById(
                input.documentId,
                patch
            );

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }

            return Result.ok({
                _id: updated._id,
                title: updated.props.title,
                content: updated.props.content,
                folder: updated.props.folder,
                createdBy: updated.props.createdBy,
                lastEditedBy: updated.props.lastEditedBy,
                createdAt: updated.props.createdAt,
                updatedAt: updated.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update LaTeX document',
                500
            ));
        }
    }
};
