import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetLatexDocumentInputDTO } from '@modules/latex/dtos/GetLatexDocumentDTO';
import type { LatexDocumentDTO } from '@modules/latex/dtos/LatexDocumentDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetLatexDocumentUseCase implements IUseCase<GetLatexDocumentInputDTO, LatexDocumentDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: GetLatexDocumentInputDTO): Promise<LatexDocumentDTO> {
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

        return {
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        };
    }
}
