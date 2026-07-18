import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/UpdateLatexDocumentDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class UpdateLatexDocumentUseCase implements IUseCase<UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: UpdateLatexDocumentInputDTO): Promise<UpdateLatexDocumentOutputDTO> {
        const existing = await this.latexDocumentRepository.findByTeamAndDocumentId(
            input.teamId,
            input.documentId
        );

        if (!existing) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }

        const patch: Record<string, unknown> = {
            updatedAt: new Date(),
            ...(input.userId === undefined ? {} : { lastEditedBy: input.userId })
        };

        if (input.title !== undefined) {
            patch.title = input.title.trim();
        }

        const updated = await this.latexDocumentRepository.updateById(
            input.documentId,
            patch
        );

        if (!updated) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }

        return {
            _id: updated._id,
            title: updated.props.title,
            folder: updated.props.folder,
            createdBy: updated.props.createdBy,
            lastEditedBy: updated.props.lastEditedBy,
            createdAt: updated.props.createdAt,
            updatedAt: updated.props.updatedAt
        };
    }
}
