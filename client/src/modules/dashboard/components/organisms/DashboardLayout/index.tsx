import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import Container from '@/shared/presentation/components/Container';
import DashboardSidebar from '@/modules/dashboard/components/organisms/DashboardSidebar';
import DashboardHeader from '@/modules/dashboard/components/molecules/DashboardHeader';
import TeamCreatorModal from '@/modules/team/components/organisms/TeamCreatorModal';
import PageTransition from '@/shared/presentation/components/PageTransition';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useGlobalSocketCacheSync from '@/shared/presentation/hooks/use-global-socket-cache-sync';
import './DashboardLayout.css';

const SIDEBAR_COLLAPSED_KEY = 'volt:sidebar-collapsed';

const DashboardLayout = () => {
    useGlobalSocketCacheSync();

    const { teams } = useTeamData();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    });

    const toggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsed((prev) => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            return next;
        });
    }, []);

    // Allow other modules (e.g. AI spreadsheet panel) to programmatically
    // collapse / restore the sidebar via custom DOM events.
    useEffect(() => {
        const collapsedBeforeOverride = { current: null as boolean | null };

        const handleRequestCollapse = () => {
            setSidebarCollapsed((prev) => {
                if (!prev) {
                    collapsedBeforeOverride.current = false;
                    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
                    return true;
                }
                // Already collapsed — nothing to remember
                collapsedBeforeOverride.current = null;
                return prev;
            });
        };

        const handleRequestExpand = () => {
            if (collapsedBeforeOverride.current === false) {
                setSidebarCollapsed(false);
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
            }
            collapsedBeforeOverride.current = null;
        };

        window.addEventListener('volt:request-sidebar-collapse', handleRequestCollapse);
        window.addEventListener('volt:request-sidebar-expand', handleRequestExpand);
        return () => {
            window.removeEventListener('volt:request-sidebar-collapse', handleRequestCollapse);
            window.removeEventListener('volt:request-sidebar-expand', handleRequestExpand);
        };
    }, []);

    useEffect(() => {
        const state = location.state as { fromNotFound?: boolean } | null;
        if (state?.fromNotFound) {
            sileo.info({
                title: 'Page not found',
                description: 'The page you are looking for does not exist. You have been redirected to the dashboard.'
            });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);

    return (
        <main className={`dashboard-main d-flex vh-max ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
            <TeamCreatorModal isRequired={teams.length === 0} />

            {/* Sidebar Overlay for Mobile */}
            <Container
                className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''} p-fixed inset-0`}
                onClick={() => setSidebarOpen(false)}
            />

            <DashboardSidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                collapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapsed}
            />

            <Container className='dashboard-content-wrapper'>
                <DashboardHeader setSidebarOpen={setSidebarOpen} />

                <Container className='dashboard-content-main flex-1 min-h-0 y-auto'>
                    <PageTransition key={location.pathname}>
                        <Outlet />
                    </PageTransition>
                </Container>
            </Container>
        </main>
    );
};

export default DashboardLayout;
