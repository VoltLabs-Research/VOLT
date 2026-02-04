import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useTeamStore } from '@/features/team/stores';
import TeamCreator from '@/features/team/components/organisms/TeamCreator';
import Container from '@/components/primitives/Container';
import DashboardSidebar from '@/components/organisms/dashboard/Sidebar';
import DashboardHeader from '@/components/molecules/dashboard/DashboardHeader';
import '@/components/organisms/dashboard/DashboardLayout/DashboardLayout.css';

const DashboardLayout = () => {
    const teams = useTeamStore((state) => state.teams);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <main className='dashboard-main d-flex vh-max'>
            <TeamCreator isRequired={teams.length === 0} />

            {/* Sidebar Overlay for Mobile */}
            <div
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
