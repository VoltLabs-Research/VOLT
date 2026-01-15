import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import UserDeletedEvent from '@/src/modules/auth/domain/events/UserDeletedEvent';
import { NOTIFICATION_TOKENS } from '../../infrastructure/di/NotificationTokens';
import { INotificationRepository } from '../../domain/port/INotificationRepository';

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
