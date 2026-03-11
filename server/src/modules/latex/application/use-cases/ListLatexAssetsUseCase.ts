import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO } from '@modules/latex/application/dtos/ListLatexAssetsDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';

@injectable()
export class ListLatexAssetsUseCase implements IUseCase<ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository
    ) {}

    async execute(input: ListLatexAssetsInputDTO): Promise<Result<ListLatexAssetsOutputDTO, ApplicationError>> {
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

            const assets = await this.latexAssetRepository.findAllByDocument(input.documentId);

            return Result.ok(assets.map((asset) => ({
                _id: asset._id,
                documentId: asset.props.document,
                originalName: asset.props.originalName,
                url: asset.props.url,
                mimetype: asset.props.mimetype,
                size: asset.props.size,
                createdAt: asset.props.createdAt
            })));
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to list LaTeX assets',
                500
            ));
        }
    }
};
