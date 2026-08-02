import service from '../api/notification-service';
import { createMutation, createPaginatedQuery } from '@/shared/query';
import type { Notification } from '@volt/contracts/modules/notification/domain';

const BASE_KEY = 'notifications';
const DEFAULT_LIMIT = 20;

const notificationQuery = createPaginatedQuery<Notification, { limit: number }>({
    baseKey: BASE_KEY,
    defaultLimit: DEFAULT_LIMIT,
    detailKey: (id: string) => [BASE_KEY, 'detail', id],
    service: {
        list: service.getAll
    }
});

export const useNotificationsInfiniteQuery = () => {
    return notificationQuery.useInfiniteListQuery({ limit: DEFAULT_LIMIT });
};

export const prependNotificationToInfiniteCache = (notification: Notification) => {
    notificationQuery.cache.upsert(notification);
};

export const useMarkAllReadMutation = createMutation<void, void>(
    () => service.markAllAsRead({}),
    () => {
        notificationQuery.cache.patchAllInfiniteLists((current) => ({
            ...current,
            pages: current.pages.map((page) => ({
                ...page,
                data: page.data.map((notification) => ({
                    ...notification,
                    read: true
                }))
            })),
            pageParams: current.pageParams
        }));

        return notificationQuery.cache.invalidate();
    }
);
