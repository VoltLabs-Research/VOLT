import service from '../api/notification-service';
import { useMutation } from '@tanstack/react-query';
import {
    buildKeys,
    createPaginatedQuery,
    withSuccess
} from '@/shared/query';
import type { MutationOptions } from '@/shared/query';
import type { Notification } from '@volt/contracts/modules/notification/domain';

export interface NotificationQueryParams {
    limit: number;
};

interface NotificationQueryOptions {
    enabled?: boolean;
};

type NotificationDetailKeys = Record<string, unknown> & {
    detail: string;
};

const BASE_KEY = 'notifications';
export const DEFAULT_LIMIT = 20;

const KEYS = buildKeys<NotificationDetailKeys>(BASE_KEY);

const notificationQuery = createPaginatedQuery<Notification, NotificationQueryParams>({
    baseKey: BASE_KEY,
    defaultLimit: DEFAULT_LIMIT,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll
    }
});

export const useNotificationsInfiniteQuery = (
    params: NotificationQueryParams,
    options?: NotificationQueryOptions
) => {
    return notificationQuery.useInfiniteListQuery(params, {
        enabled: options?.enabled
    });
};

export const prependNotificationToInfiniteCache = (
    notification: Notification
) => {
    notificationQuery.cache.upsert(notification);
};

export const markNotificationsInfiniteCacheAsRead = () => {
    notificationQuery.cache.patchAllInfiniteLists((current) => ({
        ...current,
        pages: current.pages.map((page) => ({
            ...page,
            data: page.data.map((notification) => ({ ...notification, read: true }))
        })),
        pageParams: current.pageParams
    }));
};

export const useMarkAllReadMutation = (
    options?: MutationOptions<void, void>
) => {
    return useMutation<void, Error, void>({
        ...options,
        mutationFn: () => service.markAllAsRead({}),
        onSuccess: withSuccess(() => {
            markNotificationsInfiniteCacheAsRead();
            void notificationQuery.cache.invalidate();
        }, options)
    });
};
