import DashboardHeader from '@/modules/dashboard/components/molecules/DashboardHeader';
import DashboardSidebar from '@/modules/dashboard/components/organisms/DashboardSidebar';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import { TeamCreatorModal } from '@/modules/team/components/organisms/TeamCreatorModal';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import Container from '@/shared/presentation/components/Container';
import PageTransition from '@/shared/presentation/components/PageTransition';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useGlobalSocketCacheSync from '@/shared/presentation/hooks/use-global-socket-cache-sync';
import './DashboardLayout.css';
import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';

interface DashboardLocationState {
    fromNotFound?: boolean;
};

const isDashboardLocationState = (state: unknown): state is DashboardLocationState => {
    return typeof state === 'object'
        && state !== null
        && 'fromNotFound' in state;
};

const SIDEBAR_COLLAPSED_KEY = 'volt:sidebar-collapsed';

const DashboardLayout = () => {
    useGlobalSocketCacheSync();

    const { teams } = useTeamData();
    const location = useLocation();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [headerHidden, setHeaderHidden] = useState(false);
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

    const expandSidebar = useCallback(() => {
        setSidebarCollapsed((prev) => {
            if (prev) {
                localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
                return false;
            }
            return prev;
        });
    }, []);

    useEffect(() => {
        const state = location.state;
        const fromNotFound = isDashboardLocationState(state) && state.fromNotFound === true;

        if (fromNotFound) {
            sileo.info({
                title: 'Page not found',
                description: 'The page you are looking for does not exist. You have been redirected to the dashboard.'
            });
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);

    useEffect(() => {
        const handleSidebarCollapseRequest = () => {
            setSidebarCollapsed(true);
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'true');
        };

        const handleSidebarExpandRequest = () => {
            setSidebarCollapsed(false);
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        };

        const handleHeaderHideRequest = () => {
            setHeaderHidden(true);
        };

        const handleHeaderShowRequest = () => {
            setHeaderHidden(false);
        };

        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse, handleSidebarCollapseRequest);
        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand, handleSidebarExpandRequest);
        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestHeaderHide, handleHeaderHideRequest);
        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestHeaderShow, handleHeaderShowRequest);

        return () => {
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse, handleSidebarCollapseRequest);
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand, handleSidebarExpandRequest);
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestHeaderHide, handleHeaderHideRequest);
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestHeaderShow, handleHeaderShowRequest);
        };
    }, []);

    return (
        <main className={`dashboard-main d-flex vh-max ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
            <TeamCreatorModal isRequired={teams.length === 0} />
            <JoinTeamModal />

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
                onExpandSidebar={expandSidebar}
            />

            <Container className='dashboard-content-wrapper'>
                {!headerHidden && <DashboardHeader setSidebarOpen={setSidebarOpen} />}

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
