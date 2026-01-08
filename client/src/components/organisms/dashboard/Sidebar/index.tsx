import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IoSettingsOutline, IoCloseOutline } from 'react-icons/io5';
import { HiOutlineDotsVertical } from 'react-icons/hi';
import Container from '@/components/primitives/Container';
import useAuthStore from '@/stores/slices/auth';
import Popover from '@/components/molecules/common/Popover';
import Paragraph from '@/components/primitives/Paragraph';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';
import Brand from '@/components/atoms/dashboard/Brand';
import SidebarNavigation from '@/components/atoms/dashboard/SidebarNavigation';
import SidebarFooterNavigation from '@/components/atoms/dashboard/SidebarFooterNavigation';

interface DashboardSidebarProps{
    sidebarOpen: boolean;
    setSidebarOpen: (status: boolean) => void;
};

const DashboardSidebar = ({ sidebarOpen, setSidebarOpen }: DashboardSidebarProps) => {
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);
    const user = useAuthStore((state) => state.user);
    
    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch (error) {
            console.error('Sign out failed', error);
        } finally {
            setIsSigningOut(false);
        }
    };

    const getUserInitials = () => {
        if (!user) return 'U';
        const first = user.firstName?.[0] || '';
        const last = user.lastName?.[0] || '';
        return (first + last).toUpperCase() || 'U';
    };

    return (
        <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''} p-fixed vh-max`}>
            <button
                className='sidebar-close-btn p-05 p-absolute color-primary cursor-pointer'
                onClick={() => setSidebarOpen(false)}
            >
                <IoCloseOutline size={20} />
            </button>

            <Brand />

            <SidebarNavigation
                setSettingsExpanded={setSettingsExpanded}
                setSidebarOpen={setSidebarOpen} />
           
            {/* Footer */}
            <Container className='sidebar-footer'>
                <SidebarFooterNavigation
                    setSettingsExpanded={setSettingsExpanded}
                    settingsExpanded={settingsExpanded} />
               
                <Popover
                    id="sidebar-user-menu-popover"
                    className='gap-1'
                    trigger={
                        <button
                            className='sidebar-user-section gap-075 cursor-pointer'
                            style={{ background: 'none', border: 'none', textAlign: 'left', width: '100%' }}
                        >
                            <div className='sidebar-user-avatar font-size-2 font-weight-6'>
                                {user?.avatar ? (
                                    <img src={user.avatar} alt={user.firstName} />
                                ) : (
                                    getUserInitials()
                                )}
                            </div>
                            <div className='sidebar-user-info'>
                                <Paragraph className='sidebar-user-name overflow-hidden font-size-2 font-weight-6 color-primary'>
                                    {user?.firstName} {user?.lastName}
                                </Paragraph>
                                <Paragraph className='sidebar-user-email overflow-hidden font-size-1 color-muted'>
                                    {user?.email}
                                </Paragraph>
                            </div>
                            <div className='sidebar-user-menu color-muted'>
                                <HiOutlineDotsVertical size={16} />
                            </div>
                        </button>
                    }
                >
                    <PopoverMenuItem icon={<IoSettingsOutline />} onClick={() => navigate('/dashboard/settings/general')}>
                        Account Settings
                    </PopoverMenuItem>
                    <PopoverMenuItem
                        icon={<IoCloseOutline />}
                        onClick={handleSignOut}
                        isLoading={isSigningOut}
                    >
                        Sign Out
                    </PopoverMenuItem>
                </Popover>
            </Container>
        </aside>
    );
};

export default DashboardSidebar;