import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import { ANALYSIS_TOKENS } from '../../infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '../../domain/port/IAnalysisRepository';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private readonly analysisRepository: IAnalysisRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;
        await this.analysisRepository.deleteMany({ team: teamId });
    }
};