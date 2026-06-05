import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetSubListingOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasSubListingInput {
    trajectoryId: string;
    analysisId: string;
    exposureId: string;
    timestep: number;
    subListingName: string;
    page?: number;
    limit?: number;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasSubListingUseCase implements IUseCase<
    GetPublicCanvasSubListingInput,
    GetSubListingOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,

        
        private readonly getSubListingUseCase: GetSubListingUseCase
    ) {}

    async execute(input: GetPublicCanvasSubListingInput): Promise<Result<GetSubListingOutputDTO>> {
        try {
            await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

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

            return this.getSubListingUseCase.execute({
                analysisId: input.analysisId,
                exposureId: input.exposureId,
                timestep: input.timestep,
                subListingName: input.subListingName,
                teamId: String(analysis.props.team),
                page: input.page,
                limit: input.limit
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
