import { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { PersistedNotificationDTO } from './NotificationDTO';

export interface GetMyNotificationsInputDTO{
    userId: string;
    page?: number;
    limit?: number;
};

export interface GetMyNotificationsOutputDTO extends PaginatedResult<PersistedNotificationDTO> {};
