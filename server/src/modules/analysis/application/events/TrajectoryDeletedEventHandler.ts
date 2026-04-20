import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { CascadeDeleteEachOnTrajectoryDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTrajectoryDeletedHandler';
import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/trajectory/TrajectoryDeletedEvent';
import { inject, injectable } from 'tsyringe';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export default class TrajectoryDeletedEventHandler extends CascadeDeleteEachOnTrajectoryDeletedHandler<Analysis> {
    protected readonly repository: IAnalysisRepository;

    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        analysisRepository: IAnalysisRepository,

        @inject(DeleteAnalysisByIdUseCase)
        private readonly deleteAnalysisByIdUseCase: DeleteAnalysisByIdUseCase
    ) {
        super();
        this.repository = analysisRepository;
    }

    protected async deleteOne(analysisId: string, event: TrajectoryDeletedEvent): Promise<void> {
        await this.deleteAnalysisByIdUseCase.execute({
            analysisId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
};
