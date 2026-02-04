import { useAuthStore } from '@/features/auth/stores';
import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import Tooltip from '@/components/atoms/common/Tooltip';
import { CiLogout, CiSettings } from 'react-icons/ci';
import { useNavigate } from 'react-router';
import Container from '@/components/primitives/Container';
import { useState } from 'react';
import '@/features/auth/components/atoms/SidebarUserAvatar/SidebarUserAvatar.css';

// TODO: USER AVATAR SHOULD BE A NEW COMPONENT
const SidebarUserAvatar = ({ avatarrounded = false, hideEmail = true, hideUsername = false, onClick = () => { } }) => {
    const { user, signOut } = useAuthStore();
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        try {
            setIsSigningOut(true);
            await signOut();
        } catch (error) {
            console.error('Sign out failed', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    // Si no hay usuario autenticado, mostrar una interfaz genérica o nada
    if (!user) {
        return null;
    }

    return (
        <Popover
            id="user-menu-popover"
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
                            <img src={user.avatar} alt="User Avatar" className='sidebar-user-avatar-img w-max h-max' />
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
        </Popover >
    );
};

export default SidebarUserAvatar;
