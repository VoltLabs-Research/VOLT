import { IoMenuOutline } from 'react-icons/io5';
import { GoPersonAdd } from 'react-icons/go';
import Container from '@/shared/presentation/components/Container';
import Tooltip from '@/shared/presentation/components/Tooltip';
import IconButton from '@/shared/presentation/components/IconButton';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import TeamInvitePanelPopover from '@/modules/team/presentation/components/molecules/TeamInvitePanelPopover';
import HeaderBreadcrumbs from '@/modules/dashboard/presentation/components/atoms/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/presentation/components/molecules/GlobalSearch';
import NotificationsPopover from '@/modules/notification/presentation/components/organisms/NotificationsPopover';
import './DashboardHeader.css';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
};

const DashboardHeader = ({ setSidebarOpen }: DashboardHeaderProps) => {
    const canInvite = useTeamStore((state) => state.canInvite);

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
                <GlobalSearch />
            </Container>

            <Container className='dashboard-header-right gap-05 d-flex items-center flex-1 content-end'>
                {canInvite ? (
                    <TeamInvitePanelPopover />
                ) : (
                    <Tooltip content='You must be an admin or owner to invite members' placement='bottom'>
                        <IconButton disabled>
                            <GoPersonAdd size={18} />
                        </IconButton>
                    </Tooltip>
                )}

                <NotificationsPopover />
            </Container>
        </header>
    );
};

export default DashboardHeader;
