import type { NotificationProps } from '@modules/notification/domain/entities/Notification';

export interface PersistedNotificationDTO extends NotificationProps {
    _id: string;
}
