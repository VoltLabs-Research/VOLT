import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';
import { DAILY_ACTIVITY_TOKENS } from '../../infrastructure/di/DailyActivityTokens';
import { IDailyActivityRepository } from '../../domain/ports/IDailyActivityRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        private readonly dailyActivityRepository: IDailyActivityRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;

        await this.dailyActivityRepository.deleteMany({ team: teamId });
    }
};