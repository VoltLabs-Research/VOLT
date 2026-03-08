import './DashboardNotificationsFeed.css';
import useNotificationData from '@/modules/notification/hooks/use-notification-data';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import { Bell } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { Notification } from '@/modules/notification/api/entities/notification';

const MAX_DISPLAY = 6;

const DashboardNotificationsFeed = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, isLoading } = useNotificationData();

    const displayed = notifications.slice(0, MAX_DISPLAY);

    const handleClickNotification = (notification: Notification) => {
        if (notification.link) {
            navigate(notification.link);
        }
    };

    let content = displayed.map((notification) => (
        <Container
            key={notification._id}
            className={`dashboard-notification-item list-item-hoverable d-flex gap-075 ${!notification.read ? 'unread' : ''}`}
            onClick={() => handleClickNotification(notification)}
            style={{ cursor: notification.link ? 'pointer' : 'default' }}
        >
            {!notification.read && (
                <span className='dashboard-notification-unread-dot' />
            )}
            <Container className='d-flex column gap-01 flex-1 min-w-0'>
                <span className='font-size-2 color-primary font-weight-5 text-truncate'>
                    {notification.title}
                </span>
                <span className='font-size-1 color-muted text-truncate'>
                    {notification.content}
                </span>
                <span className='font-size-1 color-muted'>
                    {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                </span>
            </Container>
            {notification.link && (
                <Container className='dashboard-notification-arrow d-flex flex-center'>
                    <GoArrowRight size={12} />
                </Container>
            )}
        </Container>
    ));

    if (isLoading && notifications.length === 0) {
        content = Array.from({ length: 4 }, (_, i) => (
            <Container key={i} className='dashboard-notification-item d-flex column gap-025'>
                <Skeleton variant='text' width='80%' height={14} />
                <Skeleton variant='text' width='50%' height={12} />
            </Container>
        ));
    } else if (displayed.length === 0) {
        content = [
            <Container key='empty' className='dashboard-notifications-empty d-flex flex-center flex-1'>
                <Bell size={20} strokeWidth={1.5} className='color-muted' />
                <span className='color-muted font-size-2'>All caught up</span>
            </Container>
        ];
    }

    return (
        <Container className='dashboard-notifications-card'>
            <Container className='dashboard-notifications-header'>
                <Container className='d-flex items-center gap-05'>
                    <Title className='font-size-3 color-primary font-weight-5'>Notifications</Title>
                    {unreadCount > 0 && (
                        <span className='dashboard-notifications-badge d-flex flex-center font-size-1 font-weight-6'>
                            {unreadCount}
                        </span>
                    )}
                </Container>
                <span className='font-size-1 color-muted'>Recent</span>
            </Container>

            <Container className='dashboard-notifications-list d-flex column flex-1 min-h-0 y-auto'>
                {content}
            </Container>
        </Container>
    );
};

export default DashboardNotificationsFeed;
