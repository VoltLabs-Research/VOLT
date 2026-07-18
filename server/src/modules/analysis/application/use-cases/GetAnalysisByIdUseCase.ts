import { ErrorCodes } from '@core/constants/error-codes';
import type { GetAnalysisByIdInputDTO, GetAnalysisByIdOutputDTO } from '@modules/analysis/application/dtos/GetAnalysisByIdDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { extractPluginId } from '@shared/application/utilities/extract-plugin-id';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { toPersistedOutput } from '@shared/domain/port/PersistedEntity';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class GetAnalysisByIdUseCase {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly repository: IAnalysisRepository
    ) {}

    async execute(input: GetAnalysisByIdInputDTO): Promise<GetAnalysisByIdOutputDTO> {
        const analysis = await this.repository.findById(input.analysisId);

        if (!analysis) {
            throw ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            );
        }

        if (input.teamId && analysis.props.team !== input.teamId) {
            throw ApplicationError.forbidden(
                ErrorCodes.TEAM_ACCESS_DENIED,
                'Analysis does not belong to this team'
            );
        }

        const persisted = toPersistedOutput(analysis);

        return {
            ...persisted,
            plugin: extractPluginId(persisted.plugin)
        };
    }
}
