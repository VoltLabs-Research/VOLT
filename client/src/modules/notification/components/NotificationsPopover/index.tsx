import useNotificationData from '../../hooks/use-notification-data';
import '../NotificationBadge/NotificationBadge.css';
import NotificationList from '../NotificationList';
import Button from '@/shared/presentation/primitives/Button';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Popover from '@/shared/presentation/primitives/Popover';
import Row from '@/shared/presentation/primitives/Row';
import PanelHeader from '@/shared/presentation/components/PanelHeader';
import useTip from '@/shared/tips/use-tip';
import { IoNotificationsOutline } from 'react-icons/io5';
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

    const trigger = (
        <IconButton
            className='notification-trigger p-relative'
            aria-label={triggerLabel}
            title={triggerLabel}
            aria-haspopup='dialog'
            aria-controls='notifications-popover'
        >
            <IoNotificationsOutline size={18} />
            {unreadCount > 0 && (
                <Row position='absolute' justify='center' radius='sm' className='notification-badge font-weight-6' aria-hidden='true'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </Row>
            )}
        </IconButton>
    );

    const renderHeaderActions = () => {
        if (unreadCount <= 0) {
            return null;
        }

        return (
            <Row gap='025'>
                <Button
                    variant='ghost'
                    size='sm'
                    className='notifications-header-action color-muted'
                    onClick={handleMarkAllAsRead}
                    disabled={isMarkingAllAsRead}
                >
                    {isMarkingAllAsRead ? 'Marking…' : 'Mark all as read'}
                </Button>
            </Row>
        );
    };

    const renderPopoverContent = (closePopover: () => void) => (
        <>
            <PanelHeader
                title='Notifications'
                actions={renderHeaderActions()}
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
            className='notifications-popover-dropdown panel-floating radius-md overflow-hidden'
            noPadding
            onOpenChange={handleOpenChange}
        >
            {renderPopoverContent}
        </Popover>
    );
};

export default NotificationsPopover;
