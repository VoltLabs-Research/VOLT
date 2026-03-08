import { useCallback, useMemo } from 'react';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { sileo } from 'sileo';
import type { Notification } from '../api/entities/notification';
import { useMarkAllReadMutation, useNotificationsInfiniteQuery } from './queries';
import useNotificationSocket from './use-notification-socket';

const DEFAULT_LIMIT = 20;

const useNotificationData = () => {
    const selectedTeamId = useSelectedTeamId() ?? undefined;

    useNotificationSocket(selectedTeamId, DEFAULT_LIMIT);

    const infiniteQuery = useNotificationsInfiniteQuery(
        { teamId: selectedTeamId ?? '', limit: DEFAULT_LIMIT },
        {
            enabled: !!selectedTeamId
        }
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
        teamId: selectedTeamId ?? '',
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
        if (!selectedTeamId) {
            return;
        }

        try {
            await markAllReadMutation.mutateAsync();
            sileo.success({ title: 'All notifications marked as read' });
        } catch {
            sileo.error({ title: 'Failed to mark notifications as read' });
        }
    }, [markAllReadMutation, selectedTeamId]);

    return {
        notifications: allNotifications,
        unreadCount,
        fetchNotifications,
        loadMore,
        markAllAsRead,
        hasMore: !!infiniteQuery.hasNextPage,
        isLoading: infiniteQuery.isLoading
    };
};

export default useNotificationData;
