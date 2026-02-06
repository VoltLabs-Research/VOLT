import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@shared/application/events/IEventHandler';
import UserDeletedEvent from '@modules/auth/domain/events/UserDeletedEvent';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';

@injectable()
export default class UserDeletedEventHandler implements IEventHandler<UserDeletedEvent> {
    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        private readonly notificationRepository: INotificationRepository
    ){}

    async handle(event: UserDeletedEvent): Promise<void> {
        const { userId } = event.payload;
        await this.notificationRepository.deleteMany({ recipient: userId });
    }
}
