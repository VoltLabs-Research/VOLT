import Brand from '@/modules/dashboard/components/atoms/Brand';
import SidebarFooterNavigation from '@/modules/dashboard/components/atoms/SidebarFooterNavigation';
import SidebarNavigation from '@/modules/dashboard/components/atoms/SidebarNavigation';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import './DashboardSidebar.css';
import { useState } from 'react';
import { IoCloseOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';

interface DashboardSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (status: boolean) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onExpandSidebar: () => void;
};

const DashboardSidebar = ({ sidebarOpen, setSidebarOpen, collapsed, onToggleCollapse, onExpandSidebar }: DashboardSidebarProps) => {
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    const handleSignOut = () => {
        try {
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        } catch {
            sileo.error({ title: 'Sign out failed', description: 'Please try again.' });
        } finally {
            setIsSigningOut(false);
        }
    };

    const handleSettingsClick = () => {
        navigate('/dashboard/settings/general');
    };

    return (
        <aside className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''} p-fixed vh-max`}>
            <IconButton
                className='sidebar-close-btn p-absolute'
                onClick={() => setSidebarOpen(false)}
            >
                <IoCloseOutline size={20} />
            </IconButton>

            <Brand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

            <SidebarNavigation
                setSidebarOpen={setSidebarOpen}
                collapsed={collapsed}
                onExpandSidebar={onExpandSidebar}
            />

            <Container className='sidebar-footer'>
                <SidebarFooterNavigation
                    setSettingsExpanded={setSettingsExpanded}
                    settingsExpanded={settingsExpanded}
                    collapsed={collapsed}
                />

                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                    collapsed={collapsed}
                />
            </Container>
        </aside>
    );
};

export default DashboardSidebar;
