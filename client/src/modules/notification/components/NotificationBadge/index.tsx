import './NotificationBadge.css';
interface NotificationBadgeProps {
    count: number;
};

const NotificationBadge = ({ count }: NotificationBadgeProps) => {
    if(count <= 0) return null;

    const displayCount = count > 99 ? '99+' : count;

    return (
        <div className='volt-container notification-badge p-absolute d-flex items-center content-center radius-sm font-weight-6' aria-hidden='true'>
            {displayCount}
        </div>
    );
};

export default NotificationBadge;
