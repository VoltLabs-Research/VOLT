import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetAnalysisFrameLogOutputDTO } from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';
import GetAnalysisFrameLogUseCase from '@modules/analysis/application/use-cases/GetAnalysisFrameLogUseCase';
import { TrajectoryReadAccessService } from '@modules/trajectory/application/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

interface GetPublicCanvasAnalysisFrameLogInput {
    trajectoryId: string;
    analysisId: string;
    timestep: number;
    afterCursor?: string;
    userId?: string;
};

@Singleton()
export class GetPublicCanvasAnalysisFrameLogUseCase implements IUseCase<
    GetPublicCanvasAnalysisFrameLogInput,
    GetAnalysisFrameLogOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,

        
        private readonly getAnalysisFrameLogUseCase: GetAnalysisFrameLogUseCase
    ) {}

    async execute(input: GetPublicCanvasAnalysisFrameLogInput): Promise<Result<GetAnalysisFrameLogOutputDTO, ApplicationError>> {
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

            return this.getAnalysisFrameLogUseCase.execute({
                teamId: String(analysis.props.team),
                analysisId: input.analysisId,
                timestep: input.timestep,
                afterCursor: input.afterCursor
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }
            throw error;
        }
    }
};
