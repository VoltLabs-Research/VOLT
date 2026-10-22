import useNotificationData from './use-notification-data';
import NotificationList from '../NotificationList';
import useTip from '@/shared/tips/use-tip';
import { Button, PopoverContent, PopoverDialog, PopoverRoot, PopoverTrigger } from '@heroui/react';
import { Bell } from 'lucide-react';
import { useState } from 'react';

const NotificationsPopover = () => {
    useTip('notifications-mark-read');

    const [isOpen, setIsOpen] = useState(false);

    const {
        notifications,
        unreadCount,
        fetchNotifications,
        loadMore,
        markAllAsRead,
        isMarkingAllAsRead,
        hasMore,
        isLoading
    } = useNotificationData();

    const handleOpenChange = (nextIsOpen: boolean) => {
        setIsOpen(nextIsOpen);

        if (nextIsOpen) {
            fetchNotifications();
        }
    };

    const closePopover = () => setIsOpen(false);
    const badgeLabel = unreadCount > 99 ? '99+' : unreadCount;

    const triggerLabel = unreadCount > 0
        ? `Open notifications. ${unreadCount} unread.`
        : 'Open notifications';

    return (
        <PopoverRoot isOpen={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger<'button'>
                type='button'
                className='relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/6 aria-expanded:text-foreground md:size-9'
                aria-label={triggerLabel}
                title={triggerLabel}
                render={(triggerProps) => <button {...triggerProps} />}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className='absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-2xs leading-none font-medium text-accent-foreground tabular-nums' aria-hidden='true'>
                        {badgeLabel}
                    </span>
                )}
            </PopoverTrigger>
            <PopoverContent placement='bottom end' className='w-[23rem] max-w-[calc(100vw-1rem)] overflow-hidden'>
                <PopoverDialog aria-label='Notifications' className='flex max-h-[min(30rem,70dvh)] flex-col p-1.5'>
                    <div className='flex items-center justify-between gap-3 px-2.5 pt-2 pb-1.5'>
                        <h2 className='text-base font-medium'>Notifications</h2>
                        {unreadCount > 0 && (
                            <Button
                                variant='ghost'
                                size='sm'
                                className='h-auto min-h-0 border-none bg-transparent p-0 text-sm font-normal text-muted hover:bg-transparent hover:text-foreground focus-visible:text-foreground disabled:cursor-progress disabled:opacity-70'
                                onPress={markAllAsRead}
                                isDisabled={isMarkingAllAsRead}
                            >
                                {isMarkingAllAsRead ? 'Marking…' : 'Mark all as read'}
                            </Button>
                        )}
                    </div>
                    <NotificationList
                        notifications={notifications}
                        isLoading={isLoading}
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        onClose={closePopover}
                    />
                </PopoverDialog>
            </PopoverContent>
        </PopoverRoot>
    );
};

export default NotificationsPopover;
