import './DashboardHeader.css';
import HeaderBreadcrumbs from '@/modules/dashboard/components/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/components/GlobalSearch';
import { TeamInvitePanelPopover } from '@/modules/team/components/TeamInvitePanelPopover';
import AIFloatingAssistantPanel from '@/modules/ai/components/AIFloatingAssistantPanel';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import { Box, Row, IconButton, Tooltip } from '@/shared/presentation/primitives';
import ThemeToggleButton from '@/shared/presentation/components/ThemeToggleButton';
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
        <Row as='header' position='sticky' gap='1' top='0' className='dashboard-top-header'>
            <IconButton
                className='mobile-sidebar-trigger radius-xs'
                onClick={() => setSidebarOpen(true)}
            >
                <IoMenuOutline size={20} />
            </IconButton>

            <Row flex='1' className='dashboard-header-left'>
                <HeaderBreadcrumbs />
            </Row>

            <Box display='flex' justify='center' className='dashboard-header-center'>
                <GlobalSearch contextBreadcrumb={globalSearchBreadcrumb} />
            </Box>

            <Row gap='05' flex='1' justify='end' className='dashboard-header-right'>
                {inviteAction}

                <ThemeToggleButton className='dashboard-theme-toggle' />
                <AIFloatingAssistantPanel />
                <NotificationsPopover />
            </Row>
        </Row>
    );
};

export default DashboardHeader;
