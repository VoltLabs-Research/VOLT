import { IoNotificationsOutline } from 'react-icons/io5';
import Popover from '@/shared/presentation/components/Popover';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import IconButton from '@/shared/presentation/components/IconButton';
import './NotificationsPopover.css';

const NotificationsPopover = () => {
    return (
        <Popover
            id='notifications-popover'
            trigger={
                <IconButton className='dashboard-bell-trigger'>
                    <IoNotificationsOutline size={18} />
                </IconButton>
            }
            className='dashboard-notifications-dropdown glass-bg p-0 overflow-auto'
            noPadding
        >
            <Container className='p-2'>
                <Paragraph className='color-muted font-size-2 text-center'>
                    No notifications
                </Paragraph>
            </Container>
        </Popover>
    );
};

export default NotificationsPopover;
