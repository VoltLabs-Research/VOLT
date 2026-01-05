import Container from '@/components/primitives/Container';
import useNotificationStore from '@/stores/slices/notification';
import { Skeleton } from '@mui/material';
import { useNavigate } from 'react-router';

interface NotificationsProps{
    closePopover: () => void;
};

const Notifications = ({ closePopover }: NotificationsProps) => {
    const loading = useNotificationStore((state) => state.loading);
    const notifications = useNotificationStore((state) => state.notifications);
    const navigate = useNavigate();

    return (
        <>
            <Container className='d-flex items-center content-between color-primary font-weight-6 dashboard-notifications-header'>
                <span>Notifications</span>
                <button
                    className='dashboard-notifications-close color-secondary cursor-pointer'
                    onClick={(e) => {
                        e.stopPropagation();
                        closePopover();
                    }}
                >×</button>
            </Container>
            <Container className='dashboard-notifications-body'>
                {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={`notif-skel-${i}`} className='dashboard-notification-item'>
                            <Skeleton variant='text' width='60%' height={20} />
                            <Skeleton variant='text' width='90%' height={16} />
                        </div>
                    ))
                ) : (
                    <>
                        {notifications.length === 0 && (
                            <div className='dashboard-notifications-empty text-center color-secondary'>No notifications</div>
                        )}
                        {notifications.map((n) => (
                            <div
                                key={n._id}
                                className={`dashboard-notification-item ${n.read ? 'is-read' : ''} cursor-pointer`}
                                onClick={() => {
                                    if (n.link) navigate(n.link);
                                    closePopover();
                                }}
                            >
                                <div className='dashboard-notification-title font-weight-6 color-primary'>{n.title}</div>
                                <div className='dashboard-notification-content color-secondary'>{n.content}</div>
                            </div>
                        ))}
                    </>
                )}
            </Container>
        </>
    );
};

export default Notifications;