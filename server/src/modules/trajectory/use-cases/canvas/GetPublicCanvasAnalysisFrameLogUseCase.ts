import { COMPUTE_TOKENS } from '@shared/contracts/tokens';
import type { IAnalysisRepository } from '@shared/contracts/ports';
import type { IGetAnalysisFrameLogUseCase } from '@shared/contracts/ports';
import { ErrorCodes } from '@core/constants/error-codes';
import type { GetAnalysisFrameLogOutputDTO } from '@shared/contracts/dtos/GetAnalysisFrameLogDTO';
import { TrajectoryReadAccessService } from '@modules/trajectory/services/TrajectoryReadAccessService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
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
    GetAnalysisFrameLogOutputDTO
> {
    constructor(
        
        private readonly trajectoryReadAccessService: TrajectoryReadAccessService,

        
        @inject(COMPUTE_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,


        @inject(COMPUTE_TOKENS.GetAnalysisFrameLogUseCase) private readonly getAnalysisFrameLogUseCase: IGetAnalysisFrameLogUseCase
    ) {}

    async execute(input: GetPublicCanvasAnalysisFrameLogInput): Promise<GetAnalysisFrameLogOutputDTO> {
        await this.trajectoryReadAccessService.assertReadable(input.trajectoryId, input.userId);

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

        return this.getAnalysisFrameLogUseCase.execute({
            teamId: String(analysis.props.team),
            analysisId: input.analysisId,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });
    }
};
