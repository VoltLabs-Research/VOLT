import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import type { IAnalysisExecutionLogService } from '@modules/analysis/domain/port/IAnalysisExecutionLogService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IGetAnalysisFrameLogUseCase } from '@shared/contracts/ports/IGetAnalysisFrameLogUseCase';
import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';
import { Singleton, AliasOf } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
@AliasOf(COMPUTE_TOKENS.GetAnalysisFrameLogUseCase)
export default class GetAnalysisFrameLogUseCase implements IUseCase<
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
>, IGetAnalysisFrameLogUseCase {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly analysisRepository: IAnalysisRepository,
        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService) private readonly analysisExecutionLogService: IAnalysisExecutionLogService
    ) {}

    async execute(
        input: GetAnalysisFrameLogInputDTO
    ): Promise<GetAnalysisFrameLogOutputDTO> {
        const analysis = await this.analysisRepository.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            );
        }

        if (analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_ACCESS_DENIED,
                'Analysis does not belong to this team'
            );
        }

        const log = await this.analysisExecutionLogService.getFrameLog({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: analysis.props.trajectory,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });

        return log;
    }
}
