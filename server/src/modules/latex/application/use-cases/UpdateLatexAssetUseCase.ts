import { ErrorCodes } from '@core/constants/error-codes';
import type { UpdateLatexAssetInputDTO, UpdateLatexAssetOutputDTO } from '@modules/latex/application/dtos/UpdateLatexAssetDTO';
import { buildLatexAssetContentUrl } from '@modules/latex/application/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

/**
 * Updates the virtual path of a LaTeX asset (i.e., moves it to a folder).
 *
 * Only the `path` metadata is mutated; the underlying storage object is unchanged.
 */
@Singleton()
export class UpdateLatexAssetUseCase implements IUseCase<UpdateLatexAssetInputDTO, UpdateLatexAssetOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexAssetRepository: LatexAssetRepository
    ) {}

    async execute(input: UpdateLatexAssetInputDTO): Promise<Result<UpdateLatexAssetOutputDTO, ApplicationError>> {
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

            const asset = await this.latexAssetRepository.findByDocumentAndAssetId(
                input.documentId,
                input.assetId
            );

            if (!asset) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX asset not found'
                ));
            }

            const safePath = sanitizeAssetPath(input.path, asset.props.originalName);
            const updated = await this.latexAssetRepository.updateById(input.assetId, {
                path: safePath,
                updatedAt: new Date()
            });

            if (!updated) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX asset not found'
                ));
            }

            return Result.ok({
                _id: updated._id,
                documentId: updated.props.document,
                originalName: updated.props.originalName,
                path: updated.props.path,
                url: buildLatexAssetContentUrl(input.teamId, input.documentId, updated.props.storageKey),
                mimetype: updated.props.mimetype,
                size: updated.props.size,
                createdAt: updated.props.createdAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update LaTeX asset',
                500
            ));
        }
    }
}
