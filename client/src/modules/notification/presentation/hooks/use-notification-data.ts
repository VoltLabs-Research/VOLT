import { useCallback, useEffect, useRef } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useNotificationStore } from '../stores/use-notification-store';
import useNotificationUseCases from './use-notification-repository';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { sileo } from 'sileo';

const DEFAULT_LIMIT = 20;

const useNotificationData = () => {
    const selectedTeamId = useTeamStore((state) => state.selectedTeam?._id);
    const page = useNotificationStore((state) => state.page);
    const hasMore = useNotificationStore((state) => state.hasMore);
    const isLoading = useNotificationStore((state) => state.isLoading);
    const isLoadingRef = useRef(isLoading);
    const previousTeamIdRef = useRef(selectedTeamId);
    const requestGenerationRef = useRef(0);
    isLoadingRef.current = isLoading;
    const setNotifications = useNotificationStore((state) => state.setNotifications);
    const appendNotifications = useNotificationStore((state) => state.appendNotifications);
    const markAllAsReadInStore = useNotificationStore((state) => state.markAllAsRead);
    const setLoading = useNotificationStore((state) => state.setLoading);
    const setHasMore = useNotificationStore((state) => state.setHasMore);
    const setPage = useNotificationStore((state) => state.setPage);
    const setError = useNotificationStore((state) => state.setError);
    const resetNotifications = useNotificationStore((state) => state.reset);
    const { checkRBACError } = useAccessDenied();

    const { notificationRepository } = useNotificationUseCases();

    const fetchNotifications = useCallback(async (pageToFetch: number = 1) => {
        if (!selectedTeamId) {
            requestGenerationRef.current += 1;
            resetNotifications();
            return;
        }

        if (isLoadingRef.current) return;

        let requestGeneration = requestGenerationRef.current;

        if (pageToFetch === 1) {
            requestGenerationRef.current += 1;
            requestGeneration = requestGenerationRef.current;
            setHasMore(true);
            setPage(1);
        }

        setLoading(true);
        setError(null);

        try {
            const response = await notificationRepository.getAll({
                page: pageToFetch,
                limit: DEFAULT_LIMIT
            });

            if (requestGeneration !== requestGenerationRef.current) {
                return;
            }

            if (pageToFetch === 1) {
                setNotifications(response.data);
            } else {
                appendNotifications(response.data);
            }

            setHasMore(response.pagination.hasMore);
            setPage(pageToFetch);
        } catch (error: unknown) {
            if (requestGeneration !== requestGenerationRef.current) {
                return;
            }

            if(!checkRBACError(error)){
                let errorMessage = 'Failed to fetch notifications';

                if (error instanceof Error) {
                    errorMessage = error.message;
                }

                setError(errorMessage);
            }
        } finally {
            if (requestGeneration !== requestGenerationRef.current) {
                return;
            }

            setLoading(false);
        }
    }, [
        appendNotifications,
        checkRBACError,
        notificationRepository,
        resetNotifications,
        selectedTeamId,
        setError,
        setHasMore,
        setLoading,
        setNotifications,
        setPage
    ]);

    useEffect(() => {
        const previousTeamId = previousTeamIdRef.current;

        if (previousTeamId === selectedTeamId) {
            return;
        }

        previousTeamIdRef.current = selectedTeamId;
        requestGenerationRef.current += 1;
        resetNotifications();
    }, [resetNotifications, selectedTeamId]);

    const loadMore = useCallback(() => {
        if(!isLoading && hasMore){
            fetchNotifications(page + 1);
        }
    }, [isLoading, hasMore, page, fetchNotifications]);

    const markAllAsRead = useCallback(async () => {
        try {
            await notificationRepository.markAllAsRead();
            markAllAsReadInStore();
            sileo.success({ title: 'All notifications marked as read' });
        } catch {
            sileo.error({ title: 'Failed to mark notifications as read' });
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
