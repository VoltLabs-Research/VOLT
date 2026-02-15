import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import DashboardSidebar from '@/modules/dashboard/presentation/components/organisms/DashboardSidebar';
import DashboardHeader from '@/modules/dashboard/presentation/components/molecules/DashboardHeader';
import TeamCreatorModal from '@/modules/team/presentation/components/organisms/TeamCreatorModal';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useTeamData from '@/modules/team/presentation/hooks/team/use-team-data';
import './DashboardLayout.css';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const setCanInvite = useTeamStore((state) => state.setCanInvite);
    const { checkCanInvite } = useTeamData();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!selectedTeam?._id) {
            setCanInvite(false);
            return;
        }

        checkCanInvite(selectedTeam._id);
    }, [selectedTeam?._id, checkCanInvite, setCanInvite]);

    return (
        <main className='dashboard-main d-flex vh-max'>
            <TeamCreatorModal isRequired={teams.length === 0} />

            {/* Sidebar Overlay for Mobile */}
            <Container
                className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''} p-fixed inset-0`}
                onClick={() => setSidebarOpen(false)}
            />

            <DashboardSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            <Container className='dashboard-content-wrapper vh-max overflow-hidden'>
                <DashboardHeader setSidebarOpen={setSidebarOpen} />

                <Container className='dashboard-content-main overflow-hidden'>
                    <Outlet />
                </Container>
            </Container>
        </main>
    );
};

export default DashboardLayout;
