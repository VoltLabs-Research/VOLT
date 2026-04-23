import DeleteAnalysisByIdUseCase from '@modules/analysis/application/use-cases/DeleteAnalysisByIdUseCase';
import type Analysis from '@modules/analysis/domain/entities/Analysis';
import type { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import AnalysisRepository from '@modules/analysis/infrastructure/persistence/mongo/repositories/AnalysisRepository';
import TeamDeletedEvent from '@modules/team/domain/events/team/TeamDeletedEvent';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Analysis> {
    protected readonly repository: IAnalysisRepository;

    constructor(
        
        analysisRepository: AnalysisRepository,

        
        private readonly deleteAnalysisByIdUseCase: DeleteAnalysisByIdUseCase
    ) {
        super();
        this.repository = analysisRepository;
    }

    protected async deleteOne(analysisId: string, event: TeamDeletedEvent): Promise<void> {
        await this.deleteAnalysisByIdUseCase.execute({
            analysisId,
            teamId: event.payload.teamId,
            userId: event.payload.userId
        });
    }
};
