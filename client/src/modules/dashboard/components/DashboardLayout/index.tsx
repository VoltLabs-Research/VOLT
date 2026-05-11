import DashboardHeader from '@/modules/dashboard/components/DashboardHeader';
import DashboardSidebar from '@/modules/dashboard/components/DashboardSidebar';
import useGlobalSocketCacheSync from '@/modules/dashboard/hooks/use-global-socket-cache-sync';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/TrajectoryUploaderContainer';
import {
    DASHBOARD_LAYOUT_EVENTS,
    getDashboardWorkspaceChromeState,
    subscribeToDashboardWorkspaceChromeState
} from '@/modules/dashboard/utilities/layout-events';
import { TeamCreatorModal } from '@/modules/team/components/TeamCreatorModal';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import Box from '@/shared/presentation/primitives/Box';
import DemoExpirationBanner from '@/modules/cluster/components/DemoExpirationBanner';
import DemoWelcomeModal from '@/modules/cluster/components/DemoWelcomeModal';
import { useDemoClusterStore } from '@/modules/cluster/stores/use-demo-cluster-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { isTeamClusterUsable } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTip from '@/shared/tips/use-tip';
import { usePrefersReducedMotion } from '@/shared/presentation/hooks/use-prefers-reduced-motion';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sileo } from 'sileo';
import type {
    DashboardGlobalSearchBreadcrumb,
    DashboardHeaderContext
} from '@/modules/dashboard/hooks/use-dashboard-header-context';
import './DashboardLayout.css';

interface DashboardLocationState {
    fromNotFound?: boolean;
}

// Sibling routes under these prefixes share a persistent nested layout
// (e.g. tabs under /dashboard/containers/:id). Collapsing them to one key
// keeps the outlet mounted across tab switches — the nested layout fades
// its own child instead.
const NESTED_LAYOUT_PATH_PATTERNS: ReadonlyArray<RegExp> = [
    /^\/dashboard\/containers\/[^/]+/
];

const getOutletTransitionKey = (pathname: string): string => {
    for (const pattern of NESTED_LAYOUT_PATH_PATTERNS) {
        const match = pathname.match(pattern);
        if (match) return match[0];
    }
    return pathname;
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
    const prefersReducedMotion = usePrefersReducedMotion();
    const selectedTeamId = useSelectedTeamId();
    const setDemoFromCluster = useDemoClusterStore((state) => state.setFromCluster);
    const clearDemo = useDemoClusterStore((state) => state.clear);
    const demoTeamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });

    useEffect(() => {
        const clusters = demoTeamClustersQuery.data?.data ?? [];
        const demoCluster = clusters.find((cluster) => cluster.isDemo && isTeamClusterUsable(cluster)) ?? null;
        if (demoCluster) {
            setDemoFromCluster(demoCluster);
        } else {
            clearDemo();
        }
    }, [demoTeamClustersQuery.data, setDemoFromCluster, clearDemo]);
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
        <Box as='main' display='flex' height='vh-max' className={`dashboard-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
            <TeamCreatorModal isRequired={teams.length === 0} />
            <JoinTeamModal />

            {/* Sidebar Overlay for Mobile */}
            <Box position='fixed' inset='0' className={`sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`} onClick={() => setSidebarOpen(false)} />

            <DashboardSidebar
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                collapsed={sidebarCollapsed}
                onToggleCollapse={toggleSidebarCollapsed}
                onExpandSidebar={expandSidebar}
            />

            <Box className='dashboard-content-wrapper'>
                <DemoExpirationBanner />
                {!headerHidden && (
                    <DashboardHeader
                        setSidebarOpen={setSidebarOpen}
                        globalSearchBreadcrumb={globalSearchBreadcrumb}
                    />
                )}

                <Box flex='1' minH='0' overflow='y-auto' className='dashboard-content-main'>
                    <TrajectoryUploaderContainer>
                        <motion.div
                            key={getOutletTransitionKey(location.pathname)}
                            initial={prefersReducedMotion ? false : { opacity: 0 }}
                            animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                            style={{ height: '100%' }}
                        >
                            <Outlet context={outletContext} />
                        </motion.div>
                    </TrajectoryUploaderContainer>
                </Box>
                <DemoWelcomeModal />
            </Box>
        </Box>
    );
};

export default DashboardLayout;
