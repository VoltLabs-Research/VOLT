import { Row, Text } from '@/shared/presentation/primitives';
import './NotificationItem.css';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/modules/notification/api/entities/notification';

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
            <button
                type='button'
                className={`notification-item list-item-hoverable p-075 cursor-pointer radius-sm ${notification.read ? 'is-read' : 'is-unread'}`}
                onClick={handleClick}
            >
                <Row as='span' justify='between' gap='05' className='notification-item-header'>
                    <Text as='span' size='md' weight='bold' className='notification-item-title'>
                        {notification.title}
                    </Text>
                </Row>
                <Text as='span' size='sm' tone='secondary' className='notification-item-content mt-025'>
                    {notification.content}
                </Text>
            </button>
        </li>
    );
};

export default NotificationItem;
