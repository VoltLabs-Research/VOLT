import { COMPUTE_TOKENS, PLUGIN_USECASE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetSubListingOutputDTO } from '@shared/contracts/dtos';
import type { IGetSubListingUseCase } from '@shared/contracts/ports';
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

        
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,


        @inject(PLUGIN_USECASE_TOKENS.GetSubListingUseCase) private readonly getSubListingUseCase: IGetSubListingUseCase
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
