import Row from '@/shared/presentation/primitives/Row';
import './NotificationBadge.css';
interface NotificationBadgeProps {
    count: number;
};

const NotificationBadge = ({ count }: NotificationBadgeProps) => {
    if(count <= 0) return null;

    const displayCount = count > 99 ? '99+' : count;

    return (
        <Row position='absolute' justify='center' radius='sm' className='notification-badge font-weight-6' aria-hidden='true'>
            {displayCount}
        </Row>
    );
};

export default NotificationBadge;
