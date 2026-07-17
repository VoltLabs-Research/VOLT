import { useMarkAllReadMutation, useNotificationsInfiniteQuery, DEFAULT_LIMIT } from './queries';
import useNotificationSocket from './use-notification-socket';
import { showPromise } from '@/shared/ui/hooks/toast';
import { useCallback, useMemo } from 'react';
import type { Notification } from '../api/types/notification';

const useNotificationData = () => {
    useNotificationSocket();

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

    const markAllReadMutation = useMarkAllReadMutation();

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
            await showPromise(markAllReadMutation.mutateAsync(), {
                loading: { title: 'Marking notifications as read...' },
                success: { title: 'All notifications marked as read' },
                error: { title: 'Failed to mark notifications as read' }
            });
        } catch {
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
