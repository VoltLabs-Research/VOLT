import { cn } from '@heroui/react';
import DashboardHeader from '@/modules/dashboard/components/DashboardHeader';
import DashboardSidebar from '@/modules/dashboard/components/DashboardSidebar';
import DashboardBottomBar from '@/modules/dashboard/components/DashboardBottomBar';
import JobsDrawer from '@/modules/dashboard/components/JobsDrawer';
import ClustersDrawer from '@/modules/dashboard/components/ClustersDrawer';
import ActivityDrawer from '@/modules/dashboard/components/ActivityDrawer';
import PresenceDrawer from '@/modules/dashboard/components/PresenceDrawer';
import { AIChatProvider } from '@/modules/ai/providers/AIChatProvider';
import AIPageExitWidgetBridge from '@/modules/ai/components/AIPageExitWidgetBridge';
import useGlobalSocketCacheSync from '@/modules/dashboard/hooks/use-global-socket-cache-sync';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/TrajectoryUploaderContainer';
import {
    DASHBOARD_LAYOUT_EVENTS,
    getDashboardWorkspaceChromeState,
    subscribeToDashboardWorkspaceChromeState
} from '@/modules/dashboard/utils/layout-events';
import { TeamCreatorModal } from '@/modules/team/components/TeamCreatorModal';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import DemoExpirationBanner from '@/modules/cluster/components/DemoExpirationBanner';
import DemoWelcomeModal from '@/modules/cluster/components/DemoWelcomeModal';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { isTeamClusterUsable } from '@/modules/cluster/utils/is-team-cluster-usable';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTip from '@/shared/tips/use-tip';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import type {
    DashboardGlobalSearchBreadcrumb,
    DashboardHeaderContext
} from '@/modules/dashboard/hooks/use-dashboard-header-context';
import './DashboardLayout.css';

const NESTED_LAYOUT_PATH_PATTERNS: ReadonlyArray<RegExp> = [
    /^\/dashboard\/containers\/[^/]+/,
    /^\/dashboard\/ai(?=\/|$)/
];

const getOutletTransitionKey = (pathname: string): string => {
    for (const pattern of NESTED_LAYOUT_PATH_PATTERNS) {
        const match = pathname.match(pattern);
        if (match) return match[0];
    }
    return pathname;
};

const SIDEBAR_COLLAPSED_KEY = 'volt:sidebar-collapsed';

const DashboardLayout = () => {
    useGlobalSocketCacheSync();

    const { teams } = useTeamData();
    const location = useLocation();
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

    const headerHidden = workspaceChromeState.headerHidden;
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
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        setSidebarCollapsedPreference(false);
    }, []);

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

        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse, handleSidebarCollapseRequest);
        window.addEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand, handleSidebarExpandRequest);

        return () => {
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarCollapse, handleSidebarCollapseRequest);
            window.removeEventListener(DASHBOARD_LAYOUT_EVENTS.requestSidebarExpand, handleSidebarExpandRequest);
        };
    }, []);

    const outletContext = useMemo<DashboardHeaderContext>(() => ({
        setGlobalSearchBreadcrumb
    }), []);

    return (
        <AIChatProvider>
            <AIPageExitWidgetBridge />
            <main className={cn('flex h-dvh', `dashboard-main ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`)}>
                <TeamCreatorModal isRequired={teams.length === 0} />
                <JoinTeamModal />

                {/* Sidebar Overlay for Mobile */}
                <div className={cn('fixed inset-0', `sidebar-overlay ${sidebarOpen ? 'is-open' : ''}`)} onClick={() => setSidebarOpen(false)} />

                <DashboardSidebar
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    collapsed={sidebarCollapsed}
                    onToggleCollapse={toggleSidebarCollapsed}
                    onExpandSidebar={expandSidebar}
                />

                <div className='dashboard-content-wrapper'>
                    <DemoExpirationBanner />
                    {!headerHidden && (
                        <DashboardHeader
                            setSidebarOpen={setSidebarOpen}
                            globalSearchBreadcrumb={globalSearchBreadcrumb}
                        />
                    )}

                    <div className='overflow-y-auto flex-1 min-h-0 dashboard-content-main'>
                        <TrajectoryUploaderContainer>
                            <motion.div
                                key={getOutletTransitionKey(location.pathname)}
                                initial={prefersReducedMotion ? false : { opacity: 0 }}
                                animate={prefersReducedMotion ? undefined : { opacity: 1 }}
                                transition={prefersReducedMotion ? { duration: 0 } : {
                                    duration: 0.22,
                                    ease: [0.32, 0.72, 0, 1]
                                }}
                                style={{ height: '100%' }}
                            >
                                <Outlet context={outletContext} />
                            </motion.div>
                        </TrajectoryUploaderContainer>
                    </div>

                    {!headerHidden && <DashboardBottomBar />}

                    <DemoWelcomeModal />
                </div>

                <JobsDrawer />
                <ClustersDrawer />
                <ActivityDrawer />
                <PresenceDrawer />
            </main>
        </AIChatProvider>
    );
};

export default DashboardLayout;
