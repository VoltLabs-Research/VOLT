import { useLocation } from 'react-router-dom';
import { IoMenuOutline } from 'react-icons/io5';
import { GoPersonAdd } from 'react-icons/go';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Tooltip from '@/shared/presentation/components/Tooltip';
import IconButton from '@/shared/presentation/components/IconButton';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import TeamInvitePanelPopover from '@/modules/team/presentation/components/molecules/TeamInvitePanelPopover';
import HeaderBreadcrumbs from '@/modules/dashboard/presentation/components/atoms/HeaderBreadcrumbs';
import GlobalSearch from '@/modules/dashboard/presentation/components/molecules/GlobalSearch';
import NotificationsPopover from '@/modules/notification/presentation/components/organisms/NotificationsPopover';
import './DashboardHeader.css';

interface DashboardHeaderProps {
    setSidebarOpen: (status: boolean) => void;
};

const getGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good Morning';
    if (hour >= 12 && hour < 17) return 'Good Afternoon';
    if (hour >= 17 && hour < 21) return 'Good Evening';
    return 'Good Night';
};

const capitalize = (name?: string) => {
    if (!name) return '';
    const trimmed = String(name).trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const DashboardHeader = ({ setSidebarOpen }: DashboardHeaderProps) => {
    const { pathname } = useLocation();
    const user = useAuthStore((state) => state.user);
    const canInvite = useTeamStore((state) => state.canInvite);

    // useEffect(() => {
    //     if (selectedTeam?._id) {
    //         checkCanInvite(selectedTeam._id);
    //     }
    // }, [selectedTeam?._id, checkCanInvite]);

    return (
        <header className='dashboard-top-header p-sticky gap-1 d-flex items-center top-0 p-075'>
            <IconButton
                className='mobile-sidebar-trigger radius-xs'
                onClick={() => setSidebarOpen(true)}
            >
                <IoMenuOutline size={20} />
            </IconButton>

            <Container className='dashboard-header-left d-flex items-center flex-1'>
                {pathname === '/dashboard' ? (
                    <Title className='header-greeting color-primary font-weight-5 font-size-3'>
                        {getGreeting()}, {capitalize(user?.firstName)}
                    </Title>
                ) : (
                    <HeaderBreadcrumbs />
                )}
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
