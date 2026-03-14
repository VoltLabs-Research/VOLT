import './NotificationItem.css';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/modules/notification/api/entities/notification';

interface NotificationItemProps {
    notification: Notification;
    onClose: () => void;
};

const NotificationItem = ({ notification, onClose }: NotificationItemProps) => {
    const navigate = useNavigate();
    const readStateLabel = notification.read ? 'Read' : 'Unread';

    const handleClick = () => {
        if (notification.link) {
            navigate(notification.link);
        }

        onClose();
    };

    return (
        <li className='notification-row'>
            <button
                type='button'
                className={`notification-item list-item-hoverable p-075 cursor-pointer radius-sm ${notification.read ? 'is-read' : 'is-unread'}`}
                onClick={handleClick}
            >
                <span className='notification-item-header d-flex items-center content-between gap-05'>
                    <span className='notification-item-title font-weight-6 color-primary font-size-2'>
                        {notification.title}
                    </span>
                    <span className={`notification-item-state ${notification.read ? 'is-read' : 'is-unread'}`}>
                        {readStateLabel}
                    </span>
                </span>
                <span className='notification-item-content color-secondary font-size-1 mt-025'>
                    {notification.content}
                </span>
            </button>
        </li>
    );
};

export default NotificationItem;
