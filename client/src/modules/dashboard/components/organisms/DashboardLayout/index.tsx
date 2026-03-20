import DashboardHeader from '@/modules/dashboard/components/molecules/DashboardHeader';
import DashboardSidebar from '@/modules/dashboard/components/organisms/DashboardSidebar';
import useGlobalSocketCacheSync from '@/modules/dashboard/hooks/use-global-socket-cache-sync';
import {
    DASHBOARD_LAYOUT_EVENTS,
    getDashboardWorkspaceChromeState,
    subscribeToDashboardWorkspaceChromeState
} from '@/modules/dashboard/utilities/layout-events';
import { TeamCreatorModal } from '@/modules/team/components/organisms/TeamCreatorModal';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import Container from '@/shared/presentation/components/Container';
import PageTransition from '@/shared/presentation/components/PageTransition';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import type { DashboardGlobalSearchBreadcrumb } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import type { DashboardHeaderContext } from '@/modules/dashboard/hooks/use-dashboard-header-context';
import './DashboardLayout.css';

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
    const [headerHiddenOverride, setHeaderHiddenOverride] = useState(false);
    const [globalSearchBreadcrumb, setGlobalSearchBreadcrumb] = useState<DashboardGlobalSearchBreadcrumb | null>(null);
    const [sidebarCollapsedOverride, setSidebarCollapsedOverride] = useState(false);
    const [sidebarCollapsedPreference, setSidebarCollapsedPreference] = useState(() => {
        return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    });
    const workspaceChromeState = useSyncExternalStore(
        subscribeToDashboardWorkspaceChromeState,
        getDashboardWorkspaceChromeState,
        getDashboardWorkspaceChromeState
    );

    const headerHidden = workspaceChromeState.headerHidden || headerHiddenOverride;
    const sidebarCollapsed = workspaceChromeState.sidebarCollapsed || sidebarCollapsedOverride || sidebarCollapsedPreference;

    useTip('dashboard-sidebar-collapse', {
        enabled: !headerHidden
    });

    const toggleSidebarCollapsed = useCallback(() => {
        setSidebarCollapsedPreference((prev) => {
            const next = !prev;
            localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
            return next;
        });
    }, []);

    const expandSidebar = useCallback(() => {
        setSidebarCollapsedPreference((prev) => {
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
        setGlobalSearchBreadcrumb(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleSidebarCollapseRequest = () => {
            setSidebarCollapsedOverride(true);
        };

        const handleSidebarExpandRequest = () => {
            setSidebarCollapsedOverride(false);
        };

        const handleHeaderHideRequest = () => {
            setHeaderHiddenOverride(true);
        };

        const handleHeaderShowRequest = () => {
            setHeaderHiddenOverride(false);
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

    const outletContext = useMemo<DashboardHeaderContext>(() => ({
        setGlobalSearchBreadcrumb
    }), []);

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
                {!headerHidden && (
                    <DashboardHeader
                        setSidebarOpen={setSidebarOpen}
                        globalSearchBreadcrumb={globalSearchBreadcrumb}
                    />
                )}

                <Container className='dashboard-content-main flex-1 min-h-0 y-auto'>
                    <PageTransition key={location.pathname}>
                        <Outlet context={outletContext} />
                    </PageTransition>
                </Container>
            </Container>
        </main>
    );
};

export default DashboardLayout;
