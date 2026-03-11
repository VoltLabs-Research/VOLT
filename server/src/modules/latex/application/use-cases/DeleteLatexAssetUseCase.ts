import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { DeleteLatexAssetInputDTO, DeleteLatexAssetOutputDTO } from '@modules/latex/application/dtos/DeleteLatexAssetDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

@injectable()
export class DeleteLatexAssetUseCase implements IUseCase<DeleteLatexAssetInputDTO, DeleteLatexAssetOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: DeleteLatexAssetInputDTO): Promise<Result<DeleteLatexAssetOutputDTO, ApplicationError>> {
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

            await this.storageService.delete(SYS_BUCKETS.LATEX_ASSETS, asset.props.storageKey);
            await this.latexAssetRepository.deleteById(input.assetId);

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete LaTeX asset',
                500
            ));
        }
    }
};
