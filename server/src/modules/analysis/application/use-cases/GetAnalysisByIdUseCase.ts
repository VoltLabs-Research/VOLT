import { ErrorCodes } from '@core/constants/error-codes';
import type { GetAnalysisByIdInputDTO, GetAnalysisByIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import { extractPluginId } from '@modules/analysis/infrastructure/services/AnalysisPluginDisplayNameService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class GetAnalysisByIdUseCase {
    constructor(
        private readonly repository: AnalysisRepository
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

        const persisted = toPersistedOutput(analysis);

        return Result.ok({
            ...persisted,
            plugin: extractPluginId(persisted.plugin)
        });
    }
}
