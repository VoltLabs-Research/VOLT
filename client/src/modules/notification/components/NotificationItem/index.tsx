import { Button, cn } from '@heroui/react';
import type { Notification } from '@volt/contracts/modules/notification/domain';
import { useNavigate } from 'react-router-dom';
interface NotificationItemProps {
    notification: Notification;
    onClose: () => void;
};

/**
 * What `.notification-item.button` used to override on bravais's Button: a full-width
 * ghost control that stacks its two lines, keeps its own left alignment, wraps rather
 * than truncating, and grows with its content instead of holding a control height.
 */
const ITEM_CLASS_NAMES = 'flex flex-col items-start justify-start h-auto whitespace-normal text-left leading-[1.4] border-0 p-3 rounded-lg';

/**
 * The unread tint. It sits after the base classes so it beats HeroUI's ghost surface,
 * and restates the hover so an unread row still responds to the pointer — the old
 * rule lost that fight to `.button.intent-neutral.variant-ghost:hover` on specificity.
 */
const UNREAD_CLASS_NAMES = 'bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-secondary))] hover:bg-surface-hover';

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
                className={cn(ITEM_CLASS_NAMES, notification.read ? undefined : UNREAD_CLASS_NAMES)}
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
