import Popover from '@/shared/presentation/components/molecules/common/Popover';
import Notifications from '@/modules/notification/presentation/components/organisms/Notifications';
import { useNotificationStore } from '@/modules/notification/presentation/stores';
import { IoNotificationsOutline } from 'react-icons/io5';

const NotificationsPopover = () => {
    const unreadCount = useNotificationStore((state) => state.unreadCount);
    const markAllAsRead = useNotificationStore((state) => state.markAllNotificationsAsRead);

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
                        <span className='d-flex items-center content-center notification-badge p-absolute font-weight-6'>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </button>
            }
            className="dashboard-notifications-dropdown glass-bg p-0 overflow-auto"
            noPadding
            onOpenChange={(isOpen: boolean) => {
                if (isOpen) markAllAsRead();
            }}
        >
            {(closePopover: () => void) => (
                <Notifications closePopover={closePopover} />
            )}
        </Popover>
    );
};

export default NotificationsPopover;
