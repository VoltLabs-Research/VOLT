import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '../../domain/port/IAnalysisRepository';
import TrajectoryDeletedEvent from '@/src/modules/trajectory/domain/events/TrajectoryDeletedEvent';

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
