import service from '../api/service';
import { useMutation } from '@tanstack/react-query';
import {
    buildKeys,
    createInfiniteQuery,
    patchInfinitePages,
    prependToFirstInfinitePage,
    withSuccess
} from '@/shared/infrastructure/query';
import type { InfiniteData } from '@tanstack/react-query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { MutationOptions } from '@/shared/infrastructure/query';
import type { Notification } from '../api/entities/notification';

export interface NotificationQueryParams {
    teamId: string;
    limit: number;
};

interface NotificationQueryOptions {
    enabled?: boolean;
};

type NotificationQueryKeyMap = Record<string, unknown> & {
    notifications: NotificationQueryParams;
};

type NotificationInfiniteData = InfiniteData<PaginatedResponse<Notification>, number>;

const DEFAULT_LIMIT = 20;

const KEYS = buildKeys<NotificationQueryKeyMap>('notifications');

export const getNotificationsInfiniteQueryKey = (params: NotificationQueryParams) => {
    return KEYS.notifications(params);
};

const notificationsInfiniteQuery = createInfiniteQuery<NotificationQueryParams, Notification>(
    getNotificationsInfiniteQueryKey,
    (params, { page }) => service.getAll({
        page,
        limit: params.limit
    }),
    { defaultLimit: DEFAULT_LIMIT }
);

export const useNotificationsInfiniteQuery = (
    params: NotificationQueryParams,
    options?: NotificationQueryOptions
) => {
    return notificationsInfiniteQuery(params, {
        enabled: options?.enabled
    });
};

export const setNotificationsInfiniteQueryData = (
    params: NotificationQueryParams,
    updater: (oldData: NotificationInfiniteData | undefined) => NotificationInfiniteData | undefined
) => {
    return notificationsInfiniteQuery.setData(params, updater);
};

export const prependNotificationToInfiniteCache = (
    params: NotificationQueryParams,
    notification: Notification
) => {
    prependToFirstInfinitePage<Notification>(
        getNotificationsInfiniteQueryKey(params),
        notification
    );
};

export const markNotificationsInfiniteCacheAsRead = (params: NotificationQueryParams) => {
    patchInfinitePages<Notification>(
        getNotificationsInfiniteQueryKey(params),
        (page) => ({
            ...page,
            data: page.data.map((notification) => ({ ...notification, read: true }))
        })
    );
};

export const useMarkAllReadMutation = (params: NotificationQueryParams, options?: MutationOptions<void, void>) => {
    return useMutation<void, Error, void>({
        ...options,
        mutationFn: () => service.markAllAsRead({}),
        onSuccess: withSuccess(() => {
            markNotificationsInfiniteCacheAsRead(params);
            notificationsInfiniteQuery.invalidate(params);
        }, options)
    });
};
