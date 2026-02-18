import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTrajectoryDeletedHandler } from '@shared/application/events/DeleteManyOnTrajectoryDeletedHandler';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';

@injectable()
export default class TrajectoryDeletedEventHandler extends DeleteManyOnTrajectoryDeletedHandler {
    protected readonly repository: IAnalysisRepository;

    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        analysisRepository: IAnalysisRepository
    ){
        super();
        this.repository = analysisRepository;
    }
}
