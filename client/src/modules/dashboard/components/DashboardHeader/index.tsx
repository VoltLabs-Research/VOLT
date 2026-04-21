import './DashboardHeader.css';
import HeaderBreadcrumbs from '@/modules/dashboard/components/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
import { TeamInvitePanelPopover } from '@/modules/team/components/TeamInvitePanelPopover';
import AIFloatingAssistantPanel from '@/modules/ai/components/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import IconButton from '@/shared/presentation/components/IconButton';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { IoMenuOutline } from 'react-icons/io5';
import { GoPersonAdd } from 'react-icons/go';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
    globalSearchBreadcrumb?: DashboardGlobalSearchBreadcrumb | null;
};

const DashboardHeader = ({
    setSidebarOpen,
    globalSearchBreadcrumb
}: DashboardHeaderProps) => {
    const { canAccess } = useTeamPermissions();
    const canInvite = canAccess(['team-invitation:create']);
    let inviteAction = (
        <Tooltip content='You must be an admin or owner to invite members' placement='bottom'>
            <span>
                <IconButton disabled>
                    <GoPersonAdd size={18} />
                </IconButton>
            </span>
        </Tooltip>
    );

    if (canInvite) {
        inviteAction = <TeamInvitePanelPopover />;
    }

    return (
        <header className='dashboard-top-header p-sticky gap-1 d-flex items-center top-0'>
            <IconButton
                className='mobile-sidebar-trigger radius-xs'
                onClick={() => setSidebarOpen(true)}
            >
                <IoMenuOutline size={20} />
            </IconButton>

            <div className='volt-container dashboard-header-left d-flex items-center flex-1'>
                <HeaderBreadcrumbs />
            </div>

            <div className='volt-container dashboard-header-center d-flex content-center'>
                <GlobalSearch contextBreadcrumb={globalSearchBreadcrumb} />
            </div>

            <div className='volt-container dashboard-header-right gap-05 d-flex items-center flex-1 content-end'>
                {inviteAction}

                <ThemeToggleButton className='dashboard-theme-toggle' />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
            </div>
        </header>
    );
};

export default DashboardHeader;
