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
                    'relative flex h-auto flex-col items-start justify-start gap-0.5 rounded-3xl border-0 py-2.5 pr-7 pl-3.5 text-left leading-snug whitespace-normal hover:bg-foreground/6',
                    !notification.read && 'bg-foreground/4'
                )}
                onPress={handleClick}
            >
                {!notification.read && (
                    <span className='absolute top-4 right-3 size-1.5 rounded-full bg-foreground' aria-hidden='true' />
                )}
                <span className='block w-full min-w-0 text-sm font-medium text-foreground'>
                    {notification.title}
                </span>
                <span className='block w-full text-xs font-normal text-muted'>
                    {notification.content}
                </span>
            </Button>
        </li>
    );
};

export default NotificationItem;
