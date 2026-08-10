import { cn } from '@heroui/react';
import Brand from '@/modules/dashboard/components/Brand';
import SidebarFooterNavigation from '@/modules/dashboard/components/SidebarFooterNavigation';
import SidebarNavigation from '@/modules/dashboard/components/SidebarNavigation';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import TeamSelector from '@/modules/team/components/TeamSelector';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import { IconButton, Popover, openModal, PopoverMenu, PopoverMenuItem } from '@voltstack/bravais';
import './DashboardSidebar.css';
import { useState } from 'react';
import { Plus, UserPlus, X } from 'lucide-react';
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
    const singleTenant = useSingleTenant();

    return (
        <aside className={cn('fixed h-dvh', `dashboard-sidebar ${sidebarOpen ? 'is-open' : ''} ${collapsed ? 'is-collapsed' : ''}`)}>
            <IconButton
                className='sidebar-close-btn absolute'
                onClick={() => setSidebarOpen(false)}
                title='Close sidebar'
                aria-label='Close sidebar'
            >
                <X size={20} />
            </IconButton>

            <Brand collapsed={collapsed} onToggleCollapse={onToggleCollapse} />

            {!singleTenant && (
            <div className='sidebar-workspace'>
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
                            <Plus size={18} />
                        </IconButton>
                    }
                >
                    {(close) => (
                        <PopoverMenu label='Team actions' onClose={close}>
                            <PopoverMenuItem
                                icon={<Plus size={16} />}
                                label='Create team'
                                onClick={() => {
                                    close();
                                    openModal('team-creator-modal');
                                }}
                            />
                            <PopoverMenuItem
                                icon={<UserPlus size={16} />}
                                label='Join existing team'
                                onClick={() => {
                                    close();
                                    openModal('join-team-modal');
                                }}
                            />
                        </PopoverMenu>
                    )}
                </Popover>
            </div>
            )}

            <SidebarNavigation
                setSidebarOpen={setSidebarOpen}
                collapsed={collapsed}
                onExpandSidebar={onExpandSidebar}
            />

            <div className='sidebar-footer'>
                <SidebarFooterNavigation
                    setSettingsExpanded={setSettingsExpanded}
                    settingsExpanded={settingsExpanded}
                    collapsed={collapsed}
                />

                {/*
                  The user menu (Account Settings + Sign Out) is a per-user concern, not a
                  multi-tenant one. It must render in single-tenant/local mode too — otherwise a
                  local user has no way to sign out or reach account settings from the UI.
                */}
                <UserMenuPopover
                    onSettingsClick={handleSettingsClick}
                    onSignOut={handleSignOut}
                    isSigningOut={isSigningOut}
                    collapsed={collapsed}
                />
            </div>
        </aside>
    );
};

export default DashboardSidebar;
