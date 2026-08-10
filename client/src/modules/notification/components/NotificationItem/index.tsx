import { Button } from '@voltstack/bravais';
import './NotificationItem.css';
import type { Notification } from '@volt/contracts/modules/notification/domain';
import { useNavigate } from 'react-router-dom';
interface NotificationItemProps {
    notification: Notification;
    onClose: () => void;
};

const NotificationItem = ({ notification, onClose }: NotificationItemProps) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if (notification.link) {
            navigate(notification.link);
        }

        onClose();
    };

    return (
        <li className='notification-row'>
            <Button
                variant='ghost'
                block
                align='start'
                className={`notification-item list-item-hoverable p-3 rounded-lg ${notification.read ? 'is-read' : 'is-unread'}`}
                onClick={handleClick}
            >
                <span className='flex flex-row items-center justify-between gap-2 notification-item-header'>
                    <span className='text-sm font-semibold notification-item-title'>
                        {notification.title}
                    </span>
                </span>
                <span className='text-xs text-muted notification-item-content mt-1'>
                    {notification.content}
                </span>
            </Button>
        </li>
    );
};

export default NotificationItem;
