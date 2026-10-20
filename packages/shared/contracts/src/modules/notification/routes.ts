import { get, patch } from '../../shared/routing';
import type { Notification } from './domain';

export const notificationRoutes = {
    list: get<Notification>('/api/notifications'),
    markAllRead: patch<never, null>('/api/notifications/read-status')
} as const;
