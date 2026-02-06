import { PaginatedResult } from '@shared/domain/ports/IBaseRepository';
import { NotificationProps } from '@modules/notification/domain/entities/Notification';

export interface GetNotificationsByUserIdInputDTO{
    userId: string;
};

export interface GetNotificationsByUserIdOutputDTO extends PaginatedResult<NotificationProps>{}