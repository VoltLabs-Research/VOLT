import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { GetLatexDocumentInputDTO, GetLatexDocumentOutputDTO } from '@modules/latex/application/dtos/GetLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';

@injectable()
export class GetLatexDocumentUseCase implements IUseCase<GetLatexDocumentInputDTO, GetLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: GetLatexDocumentInputDTO): Promise<Result<GetLatexDocumentOutputDTO, ApplicationError>> {
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

            return Result.ok({
                _id: document._id,
                title: document.props.title,
                content: document.props.content,
                createdAt: document.props.createdAt,
                updatedAt: document.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to retrieve LaTeX document',
                500
            ));
        }
    }
};
