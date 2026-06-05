import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { extractPluginId } from '@modules/analysis/utilities/extract-plugin-id';
import type {
    GetPluginListingDocumentsOutputDTO
} from '@modules/plugin/application/dtos/listing-row/GetPluginListingDocumentsDTO';
import { GetPluginListingDocumentsUseCase } from '@modules/plugin/application/use-cases/listing-row/GetPluginListingDocumentsUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
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

        
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,

        
        private readonly getPluginListingDocumentsUseCase: GetPluginListingDocumentsUseCase
    ) {}

    async execute(input: GetPublicCanvasPluginListingInput): Promise<Result<GetPluginListingDocumentsOutputDTO>> {
        try {
            const trajectory = await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);
            const teamId = String(trajectory.props.team);

            if (input.analysisId) {
                const analysis = await this.analysisRepository.findById(input.analysisId);
                if (!analysis) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.ANALYSIS_NOT_FOUND,
                        'Analysis not found'
                    ));
                }

                if (String(analysis.props.trajectory) !== input.trajectoryId) {
                    return Result.fail(ApplicationError.badRequest(
                        ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                        'Analysis does not belong to the requested trajectory'
                    ));
                }

                if (extractPluginId(analysis.props.plugin) !== input.pluginId) {
                    return Result.fail(ApplicationError.badRequest(
                        ErrorCodes.TRAJECTORY_ANALYSIS_MISMATCH,
                        'Analysis does not belong to the requested plugin'
                    ));
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
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
