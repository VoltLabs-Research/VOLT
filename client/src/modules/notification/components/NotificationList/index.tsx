import './NotificationList.css';
import NotificationItem from '../NotificationItem';
import { useCallback, useEffect, useRef } from 'react';
import { Box, Skeleton, Stack, EmptyState } from '@voltstack/bravais';
import type { Notification } from '@/modules/notification/api/entities/notification';

interface NotificationListProps {
    notifications: Notification[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onClose: () => void;
};

const NotificationList = ({ 
    notifications, 
    isLoading, 
    hasMore, 
    onLoadMore, 
    onClose 
}: NotificationListProps) => {
    const containerRef = useRef<HTMLUListElement>(null);

    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || isLoading || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const threshold = 50;

        if (scrollHeight - scrollTop - clientHeight < threshold) {
            onLoadMore();
        }
    }, [isLoading, hasMore, onLoadMore]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    if (isLoading && notifications.length === 0) {
        return (
            <Stack gap='05' p='05'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Box key={`notif-skel-${i}`} className='notification-item list-item-hoverable p-075 radius-sm'>
                        <Skeleton variant='text' width='60%' height={20} />
                        <Skeleton variant='text' width='90%' height={16} />
                    </Box>
                ))}
            </Stack>
        );
    }

    if (notifications.length === 0) {
        return <EmptyState title='No notifications' description="You're all caught up!" className='p-1' />;
    }

    return (
        <ul
            ref={containerRef}
            className='notification-list-container d-flex column gap-05 p-05 y-auto'
            aria-busy={isLoading}
        >
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onClose={onClose}
                />
            ))}
            {isLoading && (
                <li className='notification-row'>
                    <Box className='notification-item list-item-hoverable p-075 radius-sm'>
                        <Skeleton variant='text' width='60%' height={20} />
                        <Skeleton variant='text' width='90%' height={16} />
                    </Box>
                </li>
            )}
        </ul>
    );
};

export default NotificationList;
