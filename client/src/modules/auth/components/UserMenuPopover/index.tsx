import './UserMenuPopover.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserInfo from '@/modules/auth/components/UserInfo';
import Avatar from '@/shared/presentation/components/Avatar';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Popover from '@/shared/presentation/components/Popover';
import { HiOutlineDotsVertical } from 'react-icons/hi';
import { IoCloseOutline, IoSettingsOutline } from 'react-icons/io5';
import type { ReactNode } from 'react';

interface UserMenuPopoverProps {
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
    trigger?: ReactNode;
    collapsed?: boolean;
};

const UserMenuPopover = ({ onSettingsClick, onSignOut, isSigningOut = false, trigger, collapsed = false }: UserMenuPopoverProps) => {
    const user = useCurrentUser();

    const collapsedTrigger = (
        <button className='user-menu-trigger user-menu-trigger-collapsed cursor-pointer'>
            <Avatar user={user} size='sm' />
        </button>
    );

    const defaultTrigger = (
        <button className='user-menu-trigger cursor-pointer'>
            <UserInfo user={user} className='f-grow-1' />
            <div className='volt-container user-menu-icon color-muted'>
                <HiOutlineDotsVertical size={16} />
            </div>
        </button>
    );

    const activeTrigger = trigger ?? (collapsed ? collapsedTrigger : defaultTrigger);

    return (
        <Popover
            id='user-menu-popover'
            className='gap-1'
            trigger={activeTrigger}
        >
            <PopoverMenuItem icon={<IoSettingsOutline />} onClick={onSettingsClick}>
                Account Settings
            </PopoverMenuItem>
            <PopoverMenuItem
                icon={<IoCloseOutline />}
                onClick={onSignOut}
                isLoading={isSigningOut}
            >
                Sign Out
            </PopoverMenuItem>
        </Popover>
    );
};

export default UserMenuPopover;
