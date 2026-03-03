import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import { IApiTrackerRepository } from '@modules/api-tracker/domain/ports/IApiTrackerRepository';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';

@injectable()
export class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject('IApiTrackerRepository') private repository: IApiTrackerRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.repository.deleteByUserId(userId);
    }
}
