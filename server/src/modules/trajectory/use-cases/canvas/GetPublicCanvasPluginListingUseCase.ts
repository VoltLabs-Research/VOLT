import { COMPUTE_TOKENS, PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { ErrorCodes } from '@core/constants/error-codes';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import type {
    GetPluginListingDocumentsOutputDTO
} from '@shared/contracts/dtos';
import type { IGetPluginListingDocumentsUseCase } from '@shared/contracts/ports';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasPluginListingInput {
    trajectoryId: string;
    pluginId: string;
    exposureName?: string;
    exposureId?: string;
    analysisId?: string;
    page?: number;
    limit?: number;
    sortAsc?: boolean;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasPluginListingUseCase implements IUseCase<
    GetPublicCanvasPluginListingInput,
    GetPluginListingDocumentsOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,


        @inject(PLUGIN_USECASE_TOKENS.GetPluginListingDocumentsUseCase) private readonly getPluginListingDocumentsUseCase: IGetPluginListingDocumentsUseCase
    ) {}

    async execute(input: GetPublicCanvasPluginListingInput): Promise<GetPluginListingDocumentsOutputDTO> {
        const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);
        const teamId = String(trajectory.props.team);

        if (input.analysisId) {
            const analysis = await this.analysisRepository.findById(input.analysisId);
            if (!analysis) {
                throw ApplicationError.notFound(
                    ErrorCodes.ANALYSIS_NOT_FOUND,
                    'Analysis not found'
                );
            }

            if (String(analysis.props.trajectory) !== input.trajectoryId) {
                throw ApplicationError.badRequest(
                    ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                    'Analysis does not belong to the requested trajectory'
                );
            }

            if (extractPluginId(analysis.props.plugin) !== input.pluginId) {
                throw ApplicationError.badRequest(
                    ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                    'Analysis does not belong to the requested plugin'
                );
            }
        }

        return this.getPluginListingDocumentsUseCase.execute({
            pluginId: input.pluginId,
            exposureName: input.exposureName,
            exposureId: input.exposureId,
            teamId,
            trajectoryId: input.trajectoryId,
            analysisId: input.analysisId,
            page: input.page,
            limit: input.limit,
            sortAsc: input.sortAsc
        });
    }
};
