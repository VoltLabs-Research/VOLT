import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CiLogout, CiSettings } from 'react-icons/ci';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import Container from '@/shared/presentation/components/Container';
import '@/modules/auth/presentation/components/atoms/SidebarUserAvatar/SidebarUserAvatar.css';

interface SidebarUserAvatarProps {
    avatarrounded?: boolean;
    hideEmail?: boolean;
    hideUsername?: boolean;
    onClick?: () => void;
}

const SidebarUserAvatar = ({
    avatarrounded = false,
    hideEmail = true,
    hideUsername = false,
    onClick = () => {}
}: SidebarUserAvatarProps) => {
    const { user, signOut } = useAuthStore();
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await Promise.resolve(signOut());
        } catch (error) {
            console.error('Sign out failed', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    if (!user) {
        return null;
    }

    return (
        <Popover
            id='user-menu-popover'
            className='gap-1'
            trigger={
                <button
                    className='sidebar-user-container d-flex items-center gap-1 cursor-pointer button-reset'
                    onClick={onClick}
                    style={{ background: 'none', border: 'none', padding: 0, textAlign: 'left', width: '100%' }}
                >
                    <Container
                        className='d-flex flex-center sidebar-user-avatar-container font-weight-5'
                        data-avatarrounded={avatarrounded}
                    >
                        {user.avatar ? (
                            <img src={user.avatar} alt='User Avatar' className='sidebar-user-avatar-img w-max h-max' />
                        ) : (
                            <span className='sidebar-user-avatar font-size-2 font-weight-6'>{user.firstName?.[0] || '?'}</span>
                        )}
                    </Container>

                    <Container className='d-flex column gap-01'>
                        {!hideUsername && (
                            <span className='sidebar-user-fullname color-primary'>{user.firstName || ''} {user.lastName || ''}</span>
                        )}
                    </Container>
                </button>
            }
        >
            <PopoverMenuItem icon={<CiSettings />} onClick={() => navigate('/dashboard/settings/general')}>
                Account Settings
            </PopoverMenuItem>
            <PopoverMenuItem
                icon={<CiLogout />}
                onClick={handleSignOut}
                isLoading={isSigningOut}
            >
                Sign Out
            </PopoverMenuItem>
        </Popover>
    );
};

export default SidebarUserAvatar;
