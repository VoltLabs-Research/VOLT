import Brand from '@/modules/dashboard/components/Brand';
import SidebarFooterNavigation from '@/modules/dashboard/components/SidebarFooterNavigation';
import SidebarNavigation from '@/modules/dashboard/components/SidebarNavigation';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import TeamSelector from '@/modules/team/components/TeamSelector';
import { Box, IconButton, Popover, openModal, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
import './DashboardSidebar.css';
import { useState } from 'react';
import { IoAddOutline, IoCloseOutline } from 'react-icons/io5';
import { PiUserPlus } from 'react-icons/pi';
interface DashboardSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (status: boolean) => void;
    collapsed: boolean;
    onToggleCollapse: () => void;
    onExpandSidebar: () => void;
}

const DashboardSidebar = ({ sidebarOpen, setSidebarOpen, collapsed, onToggleCollapse, onExpandSidebar }: DashboardSidebarProps) => {
    const [settingsExpanded, setSettingsExpanded] = useState(false);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();

    return (
        <Box as='aside' position='fixed' height='vh-max' className={`dashboard-sidebar ${sidebarOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
            <IconButton
                className='sidebar-close-btn p-absolute'
                onClick={() => setSidebarOpen(false)}
                title='Close sidebar'
                aria-label='Close sidebar'
            >
                <IoCloseOutline size={20} />
            </IconButton>

            <Brand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

            <Box className='sidebar-workspace'>
                <TeamSelector className='sidebar-workspace-selector' />
                <Popover
                    id='sidebar-workspace-actions'
                    role='menu'
                    placement='bottom-end'
                    triggerAriaHaspopup='menu'
                    ariaLabel='Team actions'
                    noPadding
                    trigger={
                        <IconButton
                            size='sm'
                            variant='ghost'
                            className='sidebar-workspace-actions-trigger'
                            title='Team actions'
                            aria-label='Team actions'
                        >
                            <IoAddOutline size={18} />
                        </IconButton>
                    }
                >
                    {(close) => (
                        <PopoverMenu label='Team actions' onClose={close}>
                            <PopoverMenuItem
                                icon={<IoAddOutline size={16} />}
                                label='Create team'
                                onClick={() => {
                                    close();
                                    openModal('team-creator-modal');
                                }}
                            />
                            <PopoverMenuItem
                                icon={<PiUserPlus size={16} />}
                                label='Join existing team'
                                onClick={() => {
                                    close();
                                    openModal('join-team-modal');
                                }}
                            />
                        </PopoverMenu>
                    )}
                </Popover>
            </Box>

            <SidebarNavigation
                setSidebarOpen={setSidebarOpen}
                collapsed={collapsed}
                onExpandSidebar={onExpandSidebar}
            />

            <Box className='sidebar-footer'>
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
            </Box>
        </Box>
    );
};

export default DashboardSidebar;
