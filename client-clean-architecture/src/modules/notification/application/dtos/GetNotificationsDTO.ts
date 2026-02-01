import type { Notification } from '../../domain/entities';

export interface GetNotificationsInputDTO {
    page?: number;
    limit?: number;
    unreadOnly?: boolean;
};

export type GetNotificationsOutputDTO = Notification[];
