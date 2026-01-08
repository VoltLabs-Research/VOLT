import { useMemo } from 'react';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';
import Tooltip from '@/components/atoms/common/Tooltip';
import { IoMenuOutline } from 'react-icons/io5';
import { useLocation } from 'react-router';
import GlobalSearch from '@/components/molecules/dashboard/GlobalSearch';
import { useTeamStore } from '@/stores/slices/team';
import useAuthStore from '@/features/auth/stores';
import { GoPersonAdd } from 'react-icons/go';
import DashboardHeaderBreadcrumbs from '@/components/atoms/dashboard/HeaderBreadcrumbs';
import TeamInvitePanelPopover from '@/features/team/components/molecules/TeamInvitePanelPopover';
import NotificationsPopover from '@/components/molecules/notifications/NotificationsPopover';

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
    const owner = useTeamStore((state) => state.owner);
    const admins = useTeamStore((state) => state.admins);

    const canInvite = useMemo(() => {
        if (!user || !owner) return false;

        // Check if user is owner
        if (owner.user._id === user._id) return true;

        // Check if user is admin
        return admins.some((admin) => admin.user._id === user._id);
    }, [user, owner, admins]);

    return (
        <header className='dashboard-top-header p-sticky gap-1'>
            <button
                className='mobile-sidebar-trigger p-05 color-primary cursor-pointer'
                onClick={() => setSidebarOpen(true)}
            >
                <IoMenuOutline size={20} />
            </button>

            <Container className='dashboard-header-left'>
                {pathname === '/dashboard' ? (
                    <Title className='header-greeting color-primary font-weight-5'>
                        {getGreeting()}, {capitalize(user?.firstName)}
                    </Title>
                ) : (
                    <DashboardHeaderBreadcrumbs />
                )}
            </Container>

            <Container className='dashboard-header-center'>
                <GlobalSearch />
            </Container>

            <Container className='dashboard-header-right gap-05'>
                {canInvite ? (
                    <TeamInvitePanelPopover />
                ) : (
                    <Tooltip content="You must be an admin or owner to invite members" placement="bottom">
                        <button
                            className='d-flex content-center items-center badge-container as-icon-container over-light-bg'
                            style={{ cursor: 'not-allowed', opacity: 0.6 }}
                            disabled
                        >
                            <GoPersonAdd size={18} />
                        </button>
                    </Tooltip>
                )}

                <NotificationsPopover />
            </Container>
        </header>
    );
};

export default DashboardHeader;