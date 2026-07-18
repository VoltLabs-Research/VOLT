import { get, patch } from '../../shared/routing';
import type { PersistedNotification } from './domain';

export const notificationRoutes = {
    list: get<PersistedNotification>('/api/notifications'),
    markAllRead: patch<never, null>('/api/notifications/read-status')
} as const;
