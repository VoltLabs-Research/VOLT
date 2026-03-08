import { IoNotificationsOutline } from 'react-icons/io5';
import Popover from '@/shared/presentation/components/Popover';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import NotificationBadge from '../../atoms/NotificationBadge';
import NotificationList from '../../molecules/NotificationList';
import useNotificationData from '../../../hooks/use-notification-data';
import './NotificationsPopover.css';

const NotificationsPopover = () => {
    const {
        notifications,
        unreadCount,
        fetchNotifications,
        loadMore,
        markAllAsRead,
        hasMore,
        isLoading
    } = useNotificationData();

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            return;
        }

        fetchNotifications();

        if (unreadCount > 0) {
            markAllAsRead();
        }
    };

    return (
        <Popover
            id='notifications-popover'
            trigger={
                <IconButton className='notification-trigger p-relative'>
                    <IoNotificationsOutline size={18} />
                    <NotificationBadge count={unreadCount} />
                </IconButton>
            }
            className='notifications-popover-dropdown panel-floating radius-md overflow-hidden'
            noPadding
            onOpenChange={handleOpenChange}
        >
            {(closePopover) => (
                <>
                    <Container className='notifications-header d-flex items-center content-between p-075 color-primary font-weight-6 font-size-2'>
                        <span>Notifications</span>
                        <button
                            className='notifications-close b-none cursor-pointer color-muted'
                            onClick={(e) => {
                                e.stopPropagation();
                                closePopover();
                            }}
                        >
                            ×
                        </button>
                    </Container>
                    <NotificationList
                        notifications={notifications}
                        isLoading={isLoading}
                        hasMore={hasMore}
                        onLoadMore={loadMore}
                        onClose={closePopover}
                    />
                </>
            )}
        </Popover>
    );
};

export default NotificationsPopover;
