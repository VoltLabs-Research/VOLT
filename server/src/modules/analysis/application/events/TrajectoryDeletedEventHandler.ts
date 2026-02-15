import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import TrajectoryDeletedEvent from '@modules/trajectory/domain/events/TrajectoryDeletedEvent';

@injectable()
export default class TrajectoryDeletedEventHandler implements IEventHandler<TrajectoryDeletedEvent>{
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async handle(event: TrajectoryDeletedEvent): Promise<void>{
        const { trajectoryId } = event.payload;
        await this.analysisRepository.deleteMany({ trajectory: trajectoryId });
    }
};
