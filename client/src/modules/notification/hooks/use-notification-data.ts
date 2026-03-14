import { useMarkAllReadMutation, useNotificationsInfiniteQuery } from './queries';
import useNotificationSocket from './use-notification-socket';
import { useCallback, useMemo } from 'react';
import { sileo } from 'sileo';
import type { Notification } from '../api/entities/notification';

const DEFAULT_LIMIT = 20;

const useNotificationData = () => {
    useNotificationSocket(DEFAULT_LIMIT);

    const infiniteQuery = useNotificationsInfiniteQuery(
        { limit: DEFAULT_LIMIT }
    );

    const allNotifications = useMemo((): Notification[] => {
        if (!infiniteQuery.data) {
            return [];
        }

        return infiniteQuery.data.pages.flatMap((page) => page.data);
    }, [infiniteQuery.data]);

    const unreadCount = useMemo(() => {
        return allNotifications.filter((notification) => !notification.read).length;
    }, [allNotifications]);

    const markAllReadMutation = useMarkAllReadMutation({
        limit: DEFAULT_LIMIT
    });

    const fetchNotifications = useCallback(() => {
        return infiniteQuery.refetch();
    }, [infiniteQuery]);

    const loadMore = useCallback(() => {
        if (!infiniteQuery.isFetchingNextPage && infiniteQuery.hasNextPage) {
            infiniteQuery.fetchNextPage();
        }
    }, [infiniteQuery]);

    const markAllAsRead = useCallback(async () => {
        try {
            await markAllReadMutation.mutateAsync();
            sileo.success({ title: 'All notifications marked as read' });
        } catch {
            sileo.error({ title: 'Failed to mark notifications as read' });
        }
    }, [markAllReadMutation]);

    return {
        notifications: allNotifications,
        unreadCount,
        fetchNotifications,
        loadMore,
        markAllAsRead,
        isMarkingAllAsRead: markAllReadMutation.isPending,
        hasMore: !!infiniteQuery.hasNextPage,
        isLoading: infiniteQuery.isLoading
    };
};

export default useNotificationData;
