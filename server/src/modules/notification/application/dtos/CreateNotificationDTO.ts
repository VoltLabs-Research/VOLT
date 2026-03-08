import type { PersistedNotificationDTO } from '@modules/notification/domain/port/INotificationRepository';

export interface CreateNotificationInputDTO {
    recipient: string;
    title: string;
    content: string;
    link?: string;
}

export type CreateNotificationOutputDTO = PersistedNotificationDTO;
