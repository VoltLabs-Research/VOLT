import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { requireLatexStorageClusterId } from '@modules/latex/application/utilities/latex-storage';
import type { DeleteLatexAssetInputDTO, DeleteLatexAssetOutputDTO } from '@modules/latex/application/dtos/DeleteLatexAssetDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class DeleteLatexAssetUseCase implements IUseCase<DeleteLatexAssetInputDTO, DeleteLatexAssetOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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
            const storageClusterId = requireLatexStorageClusterId(document._id, document.props);

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

            await this.objectGatewayClient.deleteObject(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, asset.props.storageKey);
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
}
