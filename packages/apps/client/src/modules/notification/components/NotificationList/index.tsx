import NotificationItem from '../NotificationItem';
import Scrollable from '@/shared/ui/components/Scrollable';
import { Skeleton } from '@heroui/react';
import { useEffect, useRef } from 'react';
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
        <Skeleton className='h-3 w-[60%] rounded-md' />
        <Skeleton className='h-2.5 w-[90%] rounded-md' />
    </>
);

const NotificationList = ({
    notifications,
    isLoading,
    hasMore,
    onLoadMore,
    onClose
}: NotificationListProps) => {
    const containerRef = useRef<HTMLDivElement>(null);

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
            <div className='flex flex-col gap-0.5'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <div className='flex flex-col gap-2 px-3.5 py-3' key={`notif-skel-${i}`}>
                        {skeletonLines}
                    </div>
                ))}
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <div className='flex flex-col items-center gap-1 px-2.5 py-8 text-center'>
                <p className='text-base font-medium'>No notifications</p>
                <p className='text-sm text-muted'>You&apos;re all caught up!</p>
            </div>
        );
    }

    return (
        <Scrollable
            ref={containerRef}
            className='min-h-0 flex-1'
        >
            <ul
                className='m-0 flex list-none flex-col gap-0.5 p-0'
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
                    <li className='list-none'>
                        <div className='flex flex-col gap-2 px-3.5 py-3'>
                            {skeletonLines}
                        </div>
                    </li>
                )}
            </ul>
        </Scrollable>
    );
};

export default NotificationList;
