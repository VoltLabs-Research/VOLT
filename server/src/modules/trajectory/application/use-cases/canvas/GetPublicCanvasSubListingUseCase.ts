import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { GetSubListingUseCase } from '@modules/plugin/application/use-cases/listing-row/GetSubListingUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { GetSubListingOutputDTO } from '@modules/plugin/application/dtos/listing-row/GetSubListingDTO';
import type { IUseCase } from '@shared/application/IUseCase';

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

@injectable()
export class GetPublicCanvasSubListingUseCase implements IUseCase<
    GetPublicCanvasSubListingInput,
    GetSubListingOutputDTO
> {
    constructor(
        @inject(TrajectoryReadAccessService)
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(GetSubListingUseCase)
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
