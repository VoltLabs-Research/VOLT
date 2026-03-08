import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { IDailyActivityRepository } from '@modules/daily-activity/domain/port/IDailyActivityRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        protected readonly repository: IDailyActivityRepository
    ) {
        super();
    }
};
