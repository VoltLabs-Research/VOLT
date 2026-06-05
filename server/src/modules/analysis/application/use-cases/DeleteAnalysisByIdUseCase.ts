import { ErrorCodes } from '@core/constants/error-codes';
import type { DeleteAnalysisByIdInputDTO } from '@modules/analysis/application/dtos/DeleteAnalysisByIdDTO';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import {
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId
} from '@modules/cluster/application/utilities/cluster-location';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

interface DeleteAnalysisByIdOutputDTO {
    success: boolean;
}

@injectable()
export default class DeleteAnalysisByIdUseCase {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) private readonly repository: IAnalysisRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
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

        await this.eventBus.publish(new AnalysisDeletedEvent({
            analysisId: input.analysisId,
            trajectoryId: analysis.props.trajectory ?? '',
            pluginId: analysis.props.plugin ?? '',
            teamId: analysis.props.team ?? '',
            teamClusterId: resolveAnalysisStorageClusterId(analysis.props),
            storageClusterId: resolveAnalysisStorageClusterId(analysis.props),
            computeClusterId: resolveAnalysisComputeClusterId(analysis.props),
            userId: input.userId ?? '',
            pluginDisplayName: analysis.props.pluginDisplayName
        }));

        return Result.ok({
            success: true
        });
    }
}
