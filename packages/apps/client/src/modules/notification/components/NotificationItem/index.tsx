import { Button, cn } from '@heroui/react';
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
        <li className='list-none'>
            <Button
                variant='ghost'
                fullWidth
                className={cn(
                    'flex flex-col items-start justify-start h-auto whitespace-normal text-left leading-[1.4] border-0 p-3 rounded-lg',
                    !notification.read && 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-secondary))] hover:bg-surface-hover'
                )}
                onPress={handleClick}
            >
                <span className='flex flex-row items-center justify-between gap-2 w-full'>
                    <span className='text-sm font-semibold block w-full min-w-0 text-left'>
                        {notification.title}
                    </span>
                </span>
                <span className='text-xs text-muted block w-full text-left mt-1'>
                    {notification.content}
                </span>
            </Button>
        </li>
    );
};

export default NotificationItem;
