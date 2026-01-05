import Popover from '@/components/molecules/common/Popover';
import Notifications from '@/components/organisms/notifications/Notifications';
import useNotificationStore from '@/stores/slices/notification';
import { IoNotificationsOutline } from 'react-icons/io5';

const NotificationsPopover = () => {
    const unreadCount = useNotificationStore((state) => state.unreadCount);
    const markAllAsRead = useNotificationStore((state) => state.markAllAsRead);

    return (
        <Popover
            id="notifications-popover"
            trigger={
                <button
                    className='d-flex content-center items-center badge-container as-icon-container over-light-bg dashboard-bell-trigger cursor-pointer p-relative'
                    type="button"
                >
                    <IoNotificationsOutline size={18} />
                    {unreadCount > 0 && (
                        <span className='d-flex items-center content-center notification-badge p-absolute'>{unreadCount > 99 ? '99+' : unreadCount}</span>
                    )}
                </button>
            }
            className="dashboard-notifications-dropdown glass-bg p-0 overflow-auto"
            noPadding
            onOpenChange={(isOpen) => {
                if(isOpen) markAllAsRead();
            }}
        >
            {(closePopover) => (
                <Notifications closePopover={closePopover} />
            )}
        </Popover>
    );
};

export default NotificationsPopover;