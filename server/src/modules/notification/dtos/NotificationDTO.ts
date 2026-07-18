import type { NotificationProps } from '@modules/notification/entities/Notification';

export interface PersistedNotificationDTO extends NotificationProps {
    _id: string;
}
