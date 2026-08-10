import './NotificationList.css';
import NotificationItem from '../NotificationItem';
import { useEffect, useRef } from 'react';
import { Skeleton, EmptyState } from '@voltstack/bravais';
import type { Notification } from '@volt/contracts/modules/notification/domain';

interface NotificationListProps {
    notifications: Notification[];
    isLoading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    onClose: () => void;
};

const LOAD_MORE_THRESHOLD = 50;

const skeletonLines = (
    <>
        <Skeleton variant='text' width='60%' height={20} />
        <Skeleton variant='text' width='90%' height={16} />
    </>
);

const NotificationList = ({ 
    notifications, 
    isLoading, 
    hasMore, 
    onLoadMore, 
    onClose 
}: NotificationListProps) => {
    const containerRef = useRef<HTMLUListElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isLoading || !hasMore) return;

            if (container.scrollHeight - container.scrollTop - container.clientHeight < LOAD_MORE_THRESHOLD) {
                onLoadMore();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [isLoading, hasMore, onLoadMore]);

    if (isLoading && notifications.length === 0) {
        return (
            <div className='flex flex-col gap-2 p-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div className='notification-item list-item-hoverable p-3 rounded-lg' key={`notif-skel-${i}`}>
                        {skeletonLines}
                    </div>
                ))}
            </div>
        );
    }

    if (notifications.length === 0) {
        return <EmptyState title='No notifications' description="You're all caught up!" className='p-4' />;
    }

    return (
        <ul
            ref={containerRef}
            className='notification-list-container flex flex-col gap-2 p-2 overflow-y-auto'
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
                    <div className='notification-item list-item-hoverable p-3 rounded-lg'>
                        {skeletonLines}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default NotificationList;
