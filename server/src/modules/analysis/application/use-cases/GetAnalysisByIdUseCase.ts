import { injectable, inject } from 'tsyringe';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/application/di/AnalysisTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import type { GetAnalysisByIdInputDTO, GetAnalysisByIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';

@injectable()
export default class GetAnalysisByIdUseCase {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly repository: IAnalysisRepository
    ) {}

    async execute(input: GetAnalysisByIdInputDTO): Promise<Result<GetAnalysisByIdOutputDTO, ApplicationError>> {
        const analysis = await this.repository.findById(input.analysisId);

        if (!analysis) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        if (input.teamId && analysis.props.team !== input.teamId) {
            return Result.fail(ApplicationError.forbidden(
                ErrorCodes.TEAM_ACCESS_DENIED,
                'Analysis does not belong to this team'
            ));
        }

        return Result.ok(toPersistedOutput<AnalysisProps>(analysis as Analysis));
    }
}
