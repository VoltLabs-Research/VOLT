import { ErrorCodes } from '@core/constants/error-codes';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';

@injectable()
export default class GetAnalysisFrameLogUseCase implements IUseCase<
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO,
    ApplicationError
> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository,

        @inject(ANALYSIS_TOKENS.AnalysisExecutionLogService)
        private readonly analysisExecutionLogService: AnalysisExecutionLogService
    ) {}

    async execute(
        input: GetAnalysisFrameLogInputDTO
    ): Promise<Result<GetAnalysisFrameLogOutputDTO, ApplicationError>> {
        const analysis = await this.analysisRepository.findById(input.analysisId);

        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        if (analysis.props.team !== input.teamId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ACCESS_DENIED,
                'Analysis does not belong to this team'
            ));
        }

        const log = await this.analysisExecutionLogService.getFrameLog({
            analysisId: input.analysisId,
            teamId: input.teamId,
            trajectoryId: analysis.props.trajectory,
            timestep: input.timestep,
            afterCursor: input.afterCursor
        });

        return Result.ok(log);
    }
}
