import NotificationItem from '../NotificationItem';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import { Skeleton } from '@heroui/react';
import { BellOff } from 'lucide-react';
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

/**
 * The two bars are sized to what bravais actually painted, not to what it reserved:
 * `variant='text'` carried `transform: scale(1, 0.6)`, so `height={20}` rendered ~12px
 * of bar inside a 20px box. HeroUI's Skeleton paints its full box, so the heights come
 * down to the painted values and the box is made up with a gap.
 */
const skeletonLines = (
    <>
        <Skeleton className='h-3 w-[60%] rounded-sm' />
        <Skeleton className='h-2.5 w-[90%] rounded-sm' />
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
                    <div className='flex flex-col gap-2 p-3 rounded-lg' key={`notif-skel-${i}`}>
                        {skeletonLines}
                    </div>
                ))}
            </div>
        );
    }

    if (notifications.length === 0) {
        return (
            <RecoveryState
                title='No notifications'
                description="You're all caught up!"
                icon={<BellOff size={26} strokeWidth={1.5} />}
                className='p-4'
            />
        );
    }

    return (
        <ul
            ref={containerRef}
            className='flex flex-col gap-2 p-2 m-0 list-none overflow-y-auto max-h-[360px] max-[480px]:max-h-[calc(60vh-60px)]'
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
                    <div className='flex flex-col gap-2 p-3 rounded-lg'>
                        {skeletonLines}
                    </div>
                </li>
            )}
        </ul>
    );
};

export default NotificationList;
