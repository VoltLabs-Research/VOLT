import { ErrorCodes } from '@core/constants/error-codes';
import type {
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO
} from '@modules/analysis/application/dtos/GetAnalysisFrameLogDTO';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import AnalysisExecutionLogService from '@modules/analysis/infrastructure/services/AnalysisExecutionLogService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export default class GetAnalysisFrameLogUseCase implements IUseCase<
    GetAnalysisFrameLogInputDTO,
    GetAnalysisFrameLogOutputDTO,
    ApplicationError
> {
    constructor(
        
        private readonly analysisRepository: AnalysisRepository,

        
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
