import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type {
    GetLatexAssetContentInputDTO,
    GetLatexAssetContentOutputDTO
} from '@modules/latex/application/dtos/GetLatexAssetContentDTO';
import {
    assertLatexAssetStorageKey,
    requireLatexStorageClusterId
} from '@modules/latex/application/utilities/latex-storage';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class GetLatexAssetContentUseCase implements IUseCase<
    GetLatexAssetContentInputDTO,
    GetLatexAssetContentOutputDTO,
    ApplicationError
> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: GetLatexAssetContentInputDTO): Promise<Result<GetLatexAssetContentOutputDTO, ApplicationError>> {
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
            assertLatexAssetStorageKey(input.teamId, input.documentId, input.key);

            const response = await this.objectGatewayClient.getStream(
                storageClusterId,
                TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                input.key
            );

            return Result.ok({
                stream: response.stream,
                contentType: response.contentType,
                contentLength: response.contentLength,
                contentEncoding: response.contentEncoding
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to load LaTeX asset content',
                500
            ));
        }
    }
}
