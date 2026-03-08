import { NOTIFICATION_TOKENS } from '@modules/notification/infrastructure/di/NotificationTokens';
import { DeleteManyOnUserDeletedHandler } from '@shared/application/events/DeleteManyOnUserDeletedHandler';
import { inject, injectable } from 'tsyringe';
import type { INotificationRepository } from '@modules/notification/domain/port/INotificationRepository';

@injectable()
export default class UserDeletedEventHandler extends DeleteManyOnUserDeletedHandler {
    protected readonly filterField = 'recipient';

    constructor(
        @inject(NOTIFICATION_TOKENS.NotificationRepository)
        protected readonly repository: INotificationRepository
    ){
        super();
    }
};
