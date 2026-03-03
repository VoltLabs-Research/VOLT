import { injectable, inject } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { DAILY_ACTIVITY_TOKENS } from '@modules/daily-activity/infrastructure/di/DailyActivityTokens';
import { IDailyActivityRepository } from '@modules/daily-activity/domain/ports/IDailyActivityRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    constructor(
        @inject(DAILY_ACTIVITY_TOKENS.DailyActivityRepository)
        protected readonly repository: IDailyActivityRepository
    ){
        super();
    }
}
