import { useMarkAllReadMutation, useNotificationsInfiniteQuery } from './queries';
import useNotificationSocket from './use-notification-socket';
import { showPromise } from '@/shared/ui/hooks/toast';

const useNotificationData = () => {
    useNotificationSocket();

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
