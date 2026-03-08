import { useRef, useCallback, useEffect } from 'react';
import { Skeleton } from '@mui/material';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import NotificationItem from '../NotificationItem';
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
    const containerRef = useRef<HTMLDivElement>(null);

    const handleScroll = useCallback(() => {
        const container = containerRef.current;
        if(!container || isLoading || !hasMore) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        const threshold = 50;

        if(scrollHeight - scrollTop - clientHeight < threshold){
            onLoadMore();
        }
    }, [isLoading, hasMore, onLoadMore]);

    useEffect(() => {
        const container = containerRef.current;
        if(!container) return;

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    if(isLoading && notifications.length === 0){
        return (
            <Container className='d-flex column gap-05 p-05'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Container key={`notif-skel-${i}`} className='notification-item list-item-hoverable p-075'>
                        <Skeleton variant='text' width='60%' height={20} />
                        <Skeleton variant='text' width='90%' height={16} />
                    </Container>
                ))}
            </Container>
        );
    }

    if(notifications.length === 0){
        return <EmptyState title='No notifications' description="You're all caught up!" />;
    }

    return (
        <Container 
            ref={containerRef}
            className='d-flex column gap-05 p-05 notification-list-container y-auto'
        >
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification._id}
                    notification={notification}
                    onClose={onClose}
                />
            ))}
            {isLoading && (
                <Container className='notification-item list-item-hoverable p-075'>
                    <Skeleton variant='text' width='60%' height={20} />
                    <Skeleton variant='text' width='90%' height={16} />
                </Container>
            )}
        </Container>
    );
};

export default NotificationList;
