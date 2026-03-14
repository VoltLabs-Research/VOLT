import useNotificationData from '../../../hooks/use-notification-data';
import NotificationBadge from '../../atoms/NotificationBadge';
import NotificationList from '../../molecules/NotificationList';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import Popover from '@/shared/presentation/components/Popover';
import Title from '@/shared/presentation/components/Title';
import { IoCloseOutline, IoNotificationsOutline } from 'react-icons/io5';
import type { MouseEvent } from 'react';
import './NotificationsPopover.css';

const NotificationsPopover = () => {
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
            <Container className='notifications-header d-flex items-center content-between gap-05 p-075 color-primary'>
                <Title as='h2' className='font-size-2 font-weight-6'>Notifications</Title>
                <Container className='d-flex items-center gap-025'>
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
                </Container>
            </Container>
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
