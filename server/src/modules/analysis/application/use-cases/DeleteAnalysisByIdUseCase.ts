import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import type { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';

interface DeleteAnalysisByIdOutputDTO {
    success: boolean;
};

@injectable()
export default class DeleteAnalysisByIdUseCase {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly repository: IAnalysisRepository
    ) {}

    async execute(input: DeleteAnalysisByIdInputDTO): Promise<Result<DeleteAnalysisByIdOutputDTO, ApplicationError>> {
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

        const deleted = await this.repository.deleteById(input.analysisId);

        if (!deleted) {
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.ANALYSIS_NOT_FOUND,
                'Analysis not found'
            ));
        }

        return Result.ok({
            success: true
        });
    }
};
