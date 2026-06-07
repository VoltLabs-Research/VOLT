import { Button, Row, Text } from '@voltstack/bravais';
import './NotificationItem.css';
import type { Notification } from '@/modules/notification/api/entities/notification';
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
                className={`notification-item list-item-hoverable p-075 radius-sm ${notification.read ? 'is-read' : 'is-unread'}`}
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
            </Button>
        </li>
    );
};

export default NotificationItem;
