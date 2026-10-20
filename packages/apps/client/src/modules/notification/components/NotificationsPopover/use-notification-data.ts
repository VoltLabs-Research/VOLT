import { prependNotificationToInfiniteCache, useMarkAllReadMutation, useNotificationsInfiniteQuery } from '../../hooks/queries';
import { SOCKET_NOTIFICATION_EVENTS } from '@/modules/socket/events/notification';
import useSocketEvent from '@/modules/socket/hooks/use-socket-event';
import { showPromise } from '@/shared/ui/hooks/toast';
import type { Notification } from '@volt/contracts/modules/notification/domain';

const useNotificationData = () => {
    useSocketEvent<Notification>(SOCKET_NOTIFICATION_EVENTS.RECEIVED, prependNotificationToInfiniteCache);

    const infiniteQuery = useNotificationsInfiniteQuery();
    const markAllReadMutation = useMarkAllReadMutation();

    const notifications = infiniteQuery.data?.pages.flatMap((page) => page.data) ?? [];

    return {
        notifications,
        unreadCount: notifications.filter((notification) => !notification.read).length,
        fetchNotifications: () => infiniteQuery.refetch(),
        loadMore: () => {
            if (!infiniteQuery.isFetchingNextPage && infiniteQuery.hasNextPage) {
                infiniteQuery.fetchNextPage();
            }
        },
        markAllAsRead: () => {
            void showPromise(markAllReadMutation.mutateAsync(), {
                loading: { title: 'Marking notifications as read...' },
                success: { title: 'All notifications marked as read' },
                error: { title: 'Failed to mark notifications as read' }
            }).catch(() => undefined);
        },
        isMarkingAllAsRead: markAllReadMutation.isPending,
        hasMore: infiniteQuery.hasNextPage,
        isLoading: infiniteQuery.isLoading
    };
};

export default useNotificationData;
