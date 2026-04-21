import useNotificationData from '../../hooks/use-notification-data';
import NotificationBadge from '../NotificationBadge';
import NotificationList from '../NotificationList';
import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import useTip from '@/shared/tips/use-tip';
import { IoCloseOutline, IoNotificationsOutline } from 'react-icons/io5';
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
        if (!isOpen) {
            return;
        }

        fetchNotifications();
    };

    const triggerLabel = unreadCount > 0
        ? `Open notifications. ${unreadCount} unread.`
        : 'Open notifications';

    const handleMarkAllAsRead = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        markAllAsRead();
    };

    const createCloseHandler = (closePopover: () => void) => {
        return (event: MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            closePopover();
        };
    };

    const trigger = (
        <IconButton
            className='notification-trigger p-relative'
            aria-label={triggerLabel}
            title={triggerLabel}
            aria-haspopup='dialog'
            aria-controls='notifications-popover'
        >
            <IoNotificationsOutline size={18} />
            <NotificationBadge count={unreadCount} />
        </IconButton>
    );

    const renderPopoverContent = (closePopover: () => void) => (
        <>
            <div className='volt-container notifications-header d-flex items-center content-between gap-05 p-075 color-primary'>
                <h2 className='volt-title font-size-2 font-weight-6'>Notifications</h2>
                <div className='volt-container d-flex items-center gap-025'>
                    {unreadCount > 0 && (
                        <button
                            type='button'
                            className='notifications-header-action color-muted'
                            onClick={handleMarkAllAsRead}
                            disabled={isMarkingAllAsRead}
                        >
                            {isMarkingAllAsRead ? 'Marking…' : 'Mark all as read'}
                        </button>
                    )}
                    <IconButton
                        className='notifications-close color-muted'
                        variant='ghost'
                        size='sm'
                        aria-label='Close notifications'
                        title='Close notifications'
                        onClick={createCloseHandler(closePopover)}
                    >
                        <IoCloseOutline size={18} />
                    </IconButton>
                </div>
            </div>
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
            className='notifications-popover-dropdown panel-floating radius-md overflow-hidden'
            noPadding
            onOpenChange={handleOpenChange}
        >
            {renderPopoverContent}
        </Popover>
    );
};

export default NotificationsPopover;
