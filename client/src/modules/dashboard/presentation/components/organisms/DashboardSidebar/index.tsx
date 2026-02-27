import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoCloseOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import IconButton from '@/shared/presentation/components/IconButton';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import Brand from '@/modules/dashboard/presentation/components/atoms/Brand';
import SidebarNavigation from '@/modules/dashboard/presentation/components/atoms/SidebarNavigation';
import SidebarFooterNavigation from '@/modules/dashboard/presentation/components/atoms/SidebarFooterNavigation';
import UserMenuPopover from '@/modules/auth/presentation/components/molecules/UserMenuPopover';
import './DashboardSidebar.css';

interface DashboardSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (status: boolean) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
};

const DashboardSidebar = ({ sidebarOpen, setSidebarOpen, collapsed, onToggleCollapse }: DashboardSidebarProps) => {
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const navigate = useNavigate();
    const [isSigningOut, setIsSigningOut] = useState(false);
    
    const handleSignOut = () => {
        try{
            setIsSigningOut(true);
            useAuthStore.getState().signOut();
        }catch(error){
            console.error('Sign out failed', error);
        }finally{
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
