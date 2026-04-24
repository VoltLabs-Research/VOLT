import './UserMenuPopover.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserInfo from '@/modules/auth/components/UserInfo';
import Button from '@/shared/presentation/primitives/Button';
import IconButton from '@/shared/presentation/primitives/IconButton';
import PopoverMenuItem from '@/shared/presentation/primitives/PopoverMenuItem';
import Avatar from '@/shared/presentation/primitives/Avatar';
import Popover from '@/shared/presentation/primitives/Popover';
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
        <IconButton
            variant='ghost'
            aria-label='Open user menu'
            className='user-menu-trigger user-menu-trigger-collapsed'
        >
            <Avatar user={user} size='sm' />
        </IconButton>
    );

    const defaultTrigger = (
        <Button
            variant='ghost'
            block
            align='start'
            className='user-menu-trigger'
            rightIcon={<HiOutlineDotsVertical size={16} />}
            aria-label='Open user menu'
        >
            <UserInfo user={user} className='f-grow-1' />
        </Button>
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
