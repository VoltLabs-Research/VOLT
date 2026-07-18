import type { ILatexAssetRepository } from '@modules/latex/ports/ILatexAssetRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO } from '@modules/latex/dtos/ListLatexAssetsDTO';
import { buildLatexAssetContentUrl } from '@modules/latex/utilities/latex-storage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class ListLatexAssetsUseCase implements IUseCase<ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository
    ) {}

    async execute(input: ListLatexAssetsInputDTO): Promise<ListLatexAssetsOutputDTO> {
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

        const assets = await this.latexAssetRepository.findAllByDocument(input.documentId);

        return assets.map((asset) => ({
            _id: asset._id,
            documentId: asset.props.document,
            originalName: asset.props.originalName,
            path: asset.props.path,
            url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.props.storageKey),
            mimetype: asset.props.mimetype,
            size: asset.props.size,
            createdAt: asset.props.createdAt
        }));
    }
}
