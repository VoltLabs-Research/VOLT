import { useCallback } from 'react';
import { useNotificationStore } from '../stores/use-notification-store';
import useNotificationUseCases from './use-notification-use-cases';
import { showSuccess, showError } from '@/shared/presentation/hooks/toast';

const DEFAULT_LIMIT = 20;

const useNotificationData = () => {
    const page = useNotificationStore((state) => state.page);
    const hasMore = useNotificationStore((state) => state.hasMore);
    const isLoading = useNotificationStore((state) => state.isLoading);
    const setNotifications = useNotificationStore((state) => state.setNotifications);
    const appendNotifications = useNotificationStore((state) => state.appendNotifications);
    const markAllAsReadInStore = useNotificationStore((state) => state.markAllAsRead);
    const setLoading = useNotificationStore((state) => state.setLoading);
    const setHasMore = useNotificationStore((state) => state.setHasMore);
    const setPage = useNotificationStore((state) => state.setPage);
    const setError = useNotificationStore((state) => state.setError);

    const { notificationRepository } = useNotificationUseCases();

    const fetchNotifications = useCallback(async (pageToFetch: number = 1) => {
        if(isLoading) return;

        setLoading(true);
        setError(null);

        try {
            const response = await notificationRepository.getAll({ 
                page: pageToFetch, 
                limit: DEFAULT_LIMIT 
            });

            if(pageToFetch === 1){
                setNotifications(response.data);
            }else{
                appendNotifications(response.data);
            }

            setHasMore(response.pagination.hasMore);
            setPage(pageToFetch);
        } catch(error: any) {
            console.error('Failed to fetch notifications:', error);
            setError(error?.message ?? 'Failed to fetch notifications');
        } finally {
            setLoading(false);
        }
    }, [isLoading, notificationRepository, setNotifications, appendNotifications, setLoading, setHasMore, setPage, setError]);

    const loadMore = useCallback(() => {
        if(!isLoading && hasMore){
            fetchNotifications(page + 1);
        }
    }, [isLoading, hasMore, page, fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationRepository.markAllAsRead();
            markAllAsReadInStore();
            showSuccess({ title: 'All notifications marked as read' });
        } catch(error) {
            console.error('Failed to mark notifications as read:', error);
            showError({ title: 'Failed to mark notifications as read' });
        }
    }, [notificationRepository, markAllAsReadInStore]);

    return { 
        fetchNotifications, 
        loadMore, 
        markAllAsRead,
        hasMore,
        isLoading 
    };
};

export default useNotificationData;
