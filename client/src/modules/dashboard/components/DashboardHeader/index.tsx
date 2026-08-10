import './DashboardHeader.css';
import HeaderBreadcrumbs from '@/modules/dashboard/components/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
import { TeamInvitePanelPopover } from '@/modules/team/components/TeamInvitePanelPopover';
import AIFloatingAssistantPanel from '@/modules/ai/components/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { IconButton, Tooltip } from '@voltstack/bravais';
import ThemeToggleButton from '@/shared/ui/components/ThemeToggleButton';
import WindowControls from '@/shared/ui/components/WindowControls';
import { Menu, UserPlus } from 'lucide-react';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
}

const DashboardHeader = ({
    setSidebarOpen,
    globalSearchBreadcrumb
}: DashboardHeaderProps) => {
    const { canAccess } = useTeamPermissions();
    const singleTenant = useSingleTenant();
    const canInvite = canAccess(['team-invitation:create']);
    let inviteAction = (
        <Tooltip content='You must be an admin or owner to invite members' placement='bottom'>
            <span>
                <IconButton disabled>
                    <UserPlus size={18} />
                </IconButton>
            </span>
        </Tooltip>
    );

    if (canInvite) {
        inviteAction = <TeamInvitePanelPopover />;
    }

    return (
        <header className='flex flex-row items-center gap-4 sticky top-0 dashboard-top-header'>
            <IconButton
                className='mobile-sidebar-trigger rounded-md'
                onClick={() => setSidebarOpen(true)}
            >
                <Menu size={20} />
            </IconButton>

            <div className='flex flex-row items-center flex-1 dashboard-header-left'>
                <HeaderBreadcrumbs />
            </div>

            <div className='flex justify-center dashboard-header-center'>
                <GlobalSearch contextBreadcrumb={globalSearchBreadcrumb} />
            </div>

            <div className='flex flex-row items-center justify-end gap-2 flex-1 dashboard-header-right'>
                {!singleTenant && inviteAction}

                <ThemeToggleButton className='dashboard-theme-toggle' />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
                <WindowControls />
            </div>
        </header>
    );
};

export default DashboardHeader;
