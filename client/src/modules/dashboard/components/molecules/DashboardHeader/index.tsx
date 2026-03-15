import './DashboardHeader.css';
import HeaderBreadcrumbs from '@/modules/dashboard/components/atoms/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/components/molecules/GlobalSearch';
import { TeamInvitePanelPopover } from '@/modules/team/components/molecules/TeamInvitePanelPopover';
import AIFloatingAssistantPanel from '@/modules/ai/components/organisms/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import Container from '@/shared/presentation/components/Container';
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

            <Container className='dashboard-header-left d-flex items-center flex-1'>
                <HeaderBreadcrumbs />
            </Container>

            <Container className='dashboard-header-center d-flex content-center'>
                <GlobalSearch contextBreadcrumb={globalSearchBreadcrumb} />
            </Container>

            <Container className='dashboard-header-right gap-05 d-flex items-center flex-1 content-end'>
                {inviteAction}

                <ThemeToggleButton className='dashboard-theme-toggle' />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
            </Container>
        </header>
    );
};

export default DashboardHeader;
