import { useNavigate } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import type { Notification } from '@/modules/notification/domain/entities';

interface NotificationItemProps {
    notification: Notification;
    onClose: () => void;
};

const NotificationItem = ({ notification, onClose }: NotificationItemProps) => {
    const navigate = useNavigate();

    const handleClick = () => {
        if(notification.link){
            navigate(notification.link);
        }
        onClose();
    };

    return (
        <Container
            className={`notification-item list-item-hoverable p-075 cursor-pointer radius-sm ${notification.read ? 'is-read' : ''}`}
            onClick={handleClick}
        >
            <Container className='font-weight-6 color-primary font-size-2'>
                {notification.title}
            </Container>
            <Container className='color-secondary font-size-1 mt-025'>
                {notification.content}
            </Container>
        </Container>
    );
};

export default NotificationItem;
