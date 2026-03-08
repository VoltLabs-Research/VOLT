import type { PersistedNotificationDTO } from './NotificationDTO';

export interface CreateNotificationInputDTO {
    recipient: string;
    title: string;
    content: string;
    link?: string;
};

export type CreateNotificationOutputDTO = PersistedNotificationDTO;
