import Container from '@/shared/presentation/components/Container';

interface NotificationBadgeProps {
    count: number;
};

const NotificationBadge = ({ count }: NotificationBadgeProps) => {
    if(count <= 0) return null;

    const displayCount = count > 99 ? '99+' : count;

    return (
        <Container className='notification-badge p-absolute d-flex items-center content-center font-weight-6'>
            {displayCount}
        </Container>
    );
};

export default NotificationBadge;
