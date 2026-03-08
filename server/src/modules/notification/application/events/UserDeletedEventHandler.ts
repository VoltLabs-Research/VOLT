import { injectable, inject } from 'tsyringe';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    protected readonly filterField = 'recipient' as const;

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        protected readonly repository: INotificationRepository
    ){
        super();
    }
}
