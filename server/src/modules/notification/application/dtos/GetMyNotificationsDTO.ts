import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { PersistedNotificationDTO } from '@modules/notification/domain/port/INotificationRepository';

export interface GetMyNotificationsInputDTO{
    userId: string;
    page?: number;
    limit?: number;
};

export interface GetMyNotificationsOutputDTO extends PaginatedResult<PersistedNotificationDTO>{}
