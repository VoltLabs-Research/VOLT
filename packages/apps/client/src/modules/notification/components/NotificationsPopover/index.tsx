import useNotificationData from './use-notification-data';
import NotificationList from '../NotificationList';
import PanelHeader from '@/shared/ui/components/PanelHeader';
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

    const triggerLabel = unreadCount > 0
        ? `Open notifications. ${unreadCount} unread.`
        : 'Open notifications';

    return (
        <PopoverRoot isOpen={isOpen} onOpenChange={handleOpenChange}>
            <PopoverTrigger<'button'>
                type='button'
                className='notification-trigger relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border-0 bg-transparent p-2.5 text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground'
                aria-label={triggerLabel}
                title={triggerLabel}
                render={(triggerProps) => <button {...triggerProps} />}
            >
                <Bell size={18} />
                {unreadCount > 0 && (
                    <span className='absolute top-0.5 right-0.5 flex flex-row items-center justify-center min-w-5 h-5 px-1.5 rounded-lg border border-surface-secondary bg-danger text-white text-2xs leading-none font-semibold' aria-hidden='true'>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </PopoverTrigger>
            <PopoverContent placement='bottom start' className='w-[360px] max-h-[420px] rounded-xl overflow-hidden max-[480px]:w-[92vw] max-[480px]:max-h-[60vh]'>
                <PopoverDialog aria-label='Notifications' className='flex flex-col p-0'>
                    <PanelHeader
                        title='Notifications'
                        actions={unreadCount > 0 ? (
                            <div className='flex flex-row items-center gap-1'>
                                <Button
                                    variant='ghost'
                                    size='sm'
                                    className='h-auto min-h-0 p-0 border-none bg-transparent cursor-pointer text-sm font-medium text-muted hover:text-foreground focus-visible:text-foreground disabled:cursor-progress disabled:opacity-70'
                                    onPress={markAllAsRead}
                                    isDisabled={isMarkingAllAsRead}
                                >
                                    {isMarkingAllAsRead ? 'Marking…' : 'Mark all as read'}
                                </Button>
                            </div>
                        ) : null}
                        onClose={closePopover}
                    />
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
