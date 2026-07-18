import { get, patch } from '../../shared/routing';
import type { PersistedNotification } from './domain';

/**
 * Every client-facing notification endpoint, typed by request/response. All
 * paths are the full wire paths (`/api/notifications`), matching the previous
 * `createHttpModule({ basePath: '/api/notifications', protected: true })`
 * routing verbatim. `list` returns a paginated result; `markAllRead` returns
 * no content (204).
 */
export const notificationRoutes = {
    list: get<PersistedNotification>('/api/notifications'),
    markAllRead: patch<never, null>('/api/notifications/read-status')
} as const;
