import { ErrorCodes } from '@core/constants/error-codes';
import type { ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO } from '@modules/latex/application/dtos/ListLatexAssetsDTO';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class ListLatexAssetsUseCase implements IUseCase<ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexAssetRepository: LatexAssetRepository
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
                path: asset.props.path,
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
}
