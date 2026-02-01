import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Container from '@/shared/presentation/components/Container';
import DashboardSidebar from '@/modules/dashboard/presentation/components/organisms/DashboardSidebar';
import DashboardHeader from '@/modules/dashboard/presentation/components/molecules/DashboardHeader';
import TeamCreatorModal from '@/modules/team/presentation/components/organisms/TeamCreatorModal';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import './DashboardLayout.css';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
