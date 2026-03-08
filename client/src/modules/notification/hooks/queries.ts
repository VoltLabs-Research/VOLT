import { useMutation, type InfiniteData } from '@tanstack/react-query';
import {
    buildKeys,
    createInfiniteQuery,
    withSuccess,
    type MutationOptions,
    patchInfinitePages,
    prependToFirstInfinitePage
} from '@/shared/infrastructure/query';
import service from '../api/service';
import type { Notification } from '../api/entities/notification';
import type { PaginatedResponse } from '@/shared/domain/pagination';

const DEFAULT_LIMIT = 20;

export interface NotificationQueryParams {
    teamId: string;
    limit?: number;
}

type NotificationInfiniteData = InfiniteData<PaginatedResponse<Notification>>;

const KEYS = buildKeys<{
    notifications: NotificationQueryParams;
}>('notifications');

export const normalizeNotificationQueryParams = (
    params: NotificationQueryParams
): NotificationQueryParams => ({
    teamId: params.teamId,
    limit: params.limit ?? DEFAULT_LIMIT
});

export const getNotificationsInfiniteQueryKey = (params: NotificationQueryParams) => {
    return KEYS.notifications(normalizeNotificationQueryParams(params));
};

const notificationsInfiniteQuery = createInfiniteQuery<NotificationQueryParams, Notification>(
    getNotificationsInfiniteQueryKey,
    (params, { page, limit }) => service.getAll({
        page,
        limit: params.limit ?? limit
    }),
    { defaultLimit: DEFAULT_LIMIT }
);

export const useNotificationsInfiniteQuery = (
    params: NotificationQueryParams,
    options?: { enabled?: boolean }
) => {
    const normalizedParams = normalizeNotificationQueryParams(params);

    return notificationsInfiniteQuery(normalizedParams, {
        enabled: options?.enabled
    });
};

export const setNotificationsInfiniteQueryData = (
    params: NotificationQueryParams,
    updater: (oldData: NotificationInfiniteData | undefined) => NotificationInfiniteData | undefined
) => {
    const normalizedParams = normalizeNotificationQueryParams(params);

    return notificationsInfiniteQuery.setData(normalizedParams, updater);
};

export const prependNotificationToInfiniteCache = (
    params: NotificationQueryParams,
    notification: Notification
) => {
    const normalizedParams = normalizeNotificationQueryParams(params);

    prependToFirstInfinitePage<Notification>(
        getNotificationsInfiniteQueryKey(normalizedParams),
        notification
    );
};

export const markNotificationsInfiniteCacheAsRead = (params: NotificationQueryParams) => {
    const normalizedParams = normalizeNotificationQueryParams(params);

    patchInfinitePages<Notification>(
        getNotificationsInfiniteQueryKey(normalizedParams),
        (page) => ({
            ...page,
            data: page.data.map((notification) => ({ ...notification, read: true }))
        })
    );
};

export const useMarkAllReadMutation = (params: NotificationQueryParams, options?: MutationOptions<void, void>) => {
    const normalizedParams = normalizeNotificationQueryParams(params);

    return useMutation<void, Error, void>({
        ...options,
        mutationFn: () => service.markAllAsRead({}),
        onSuccess: withSuccess(() => {
            markNotificationsInfiniteCacheAsRead(normalizedParams);
            void notificationsInfiniteQuery.invalidate(normalizedParams);
        }, options)
    });
};
