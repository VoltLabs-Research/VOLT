import useNotificationData from '../../hooks/use-notification-data';
import './NotificationBadge.css';
import NotificationList from '../NotificationList';
import { Button, IconButton, Popover } from '@voltstack/bravais';
import PanelHeader from '@/shared/ui/components/PanelHeader';
import useTip from '@/shared/tips/use-tip';
import { Bell } from 'lucide-react';
import type { MouseEvent } from 'react';
import './NotificationsPopover.css';

const NotificationsPopover = () => {
    useTip('notifications-mark-read');

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

    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen) {
            fetchNotifications();
        }
    };

    const triggerLabel = unreadCount > 0
        ? `Open notifications. ${unreadCount} unread.`
        : 'Open notifications';

    const handleMarkAllAsRead = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        markAllAsRead();
    };

    const trigger = (
        <IconButton
            className='notification-trigger relative'
            aria-label={triggerLabel}
            title={triggerLabel}
            aria-haspopup='dialog'
            aria-controls='notifications-popover'
        >
            <Bell size={18} />
            {unreadCount > 0 && (
                <div className='flex flex-row items-center justify-center rounded-lg absolute notification-badge font-semibold' aria-hidden='true'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </div>
            )}
        </IconButton>
    );

    const renderPopoverContent = (closePopover: () => void) => (
        <>
            <PanelHeader
                title='Notifications'
                actions={unreadCount > 0 ? (
                    <div className='flex flex-row items-center gap-1'>
                        <Button
                            variant='ghost'
                            size='sm'
                            className='notifications-header-action text-muted'
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAllAsRead}
                        >
                            {isMarkingAllAsRead ? 'Marking…' : 'Mark all as read'}
                        </Button>
                    </div>
                ) : null}
                onClose={closePopover}
                className='notifications-header'
            />
            <NotificationList
                notifications={notifications}
                isLoading={isLoading}
                hasMore={hasMore}
                onLoadMore={loadMore}
                onClose={closePopover}
            />
        </>
    );

    return (
        <Popover
            id='notifications-popover'
            trigger={trigger}
            className='notifications-popover-dropdown panel-floating rounded-xl overflow-hidden'
            noPadding
            onOpenChange={handleOpenChange}
        >
            {renderPopoverContent}
        </Popover>
    );
};

export default NotificationsPopover;
