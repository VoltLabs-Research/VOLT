import { HiOutlineDotsVertical } from 'react-icons/hi';
import { IoSettingsOutline, IoCloseOutline } from 'react-icons/io5';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import UserInfo from '@/modules/auth/presentation/components/atoms/UserInfo';
import './UserMenuPopover.css';

interface UserMenuPopoverProps {
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
};

const UserMenuPopover = ({ onSettingsClick, onSignOut, isSigningOut = false }: UserMenuPopoverProps) => {
    const user = useAuthStore((state) => state.user);

    return (
        <Popover
            id='user-menu-popover'
            className='gap-1'
            trigger={
                <button className='user-menu-trigger cursor-pointer'>
                    <UserInfo user={user} className='f-grow-1' />
                    <Container className='user-menu-icon color-muted'>
                        <HiOutlineDotsVertical size={16} />
                    </Container>
                </button>
            }
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
