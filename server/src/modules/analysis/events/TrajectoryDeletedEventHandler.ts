import DeleteAnalysisByIdUseCase from '@modules/analysis/use-cases/DeleteAnalysisByIdUseCase';
import type Analysis from '@modules/analysis/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/ports/IAnalysisRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/di/AnalysisTokens';
import type { IDomainEvent } from '@shared/domain/events/IDomainEvent';
import type { TrajectoryDeletedEventPayload } from '@shared/contracts/events';
import { CascadeDeleteEachOnTrajectoryDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTrajectoryDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

@Subscribe('trajectory.deleted')
export default class TrajectoryDeletedEventHandler extends CascadeDeleteEachOnTrajectoryDeletedHandler<Analysis> {
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository) protected readonly repository: IAnalysisRepository,
        private readonly deleteAnalysisByIdUseCase: DeleteAnalysisByIdUseCase
    ) {
        super();
    }

    protected async deleteOne(analysisId: string, event: IDomainEvent<TrajectoryDeletedEventPayload>): Promise<void> {
        await this.deleteAnalysisByIdUseCase.execute({
            analysisId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
}
