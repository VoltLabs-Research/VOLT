import { readStoredString, writeStoredString } from '@/shared/utils/local-storage';
import {
    Button,
    Tooltip,
    cn
} from '@heroui/react';
import AppNav from '@/modules/dashboard/components/AppNav';
import DashboardHeader from '@/modules/dashboard/components/DashboardHeader';
import DashboardTabBar from '@/modules/dashboard/components/DashboardTabBar';
import SettingsNav from '@/modules/dashboard/components/SettingsNav';
import TrajectoriesNav from '@/modules/dashboard/components/SectionNav/TrajectoriesNav';
import SecretKeysNav from '@/modules/dashboard/components/SectionNav/SecretKeysNav';
import DashboardSidePanel from '@/modules/dashboard/components/DashboardSidePanel';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import { dashboardPageKey } from '@/modules/dashboard/utils/page-key';
import { sidebarPanelFor } from '@/modules/dashboard/utils/sidebar-panels';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
import AINav from '@/modules/ai/components/AINav';
import AIPageExitWidgetBridge from '@/modules/ai/components/AIPageExitWidgetBridge';
import useGlobalSocketCacheSync from './use-global-socket-cache-sync';
import TrajectoryUploaderContainer from '@/modules/trajectory/components/TrajectoryUploaderContainer';
import {
    DASHBOARD_LAYOUT_EVENTS,
    getDashboardWorkspaceChromeState,
    subscribeToDashboardWorkspaceChromeState
} from '@/modules/dashboard/utils/layout-events';
import { TeamCreatorModal } from '@/modules/team/components/TeamCreatorModal';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTip from '@/shared/tips/use-tip';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import type {
    DashboardGlobalSearchBreadcrumb,
    DashboardHeaderContext
} from '@/modules/dashboard/hooks/use-dashboard-header-context';
import Scrollable from '@/shared/ui/components/Scrollable';

type SidebarRailState = 'expanded' | 'collapsed' | 'hidden';

const SIDEBAR_COLLAPSED_KEY = 'volt:sidebar-collapsed';
const RAIL_VIEWPORT_QUERY = '(width >= 64rem)';

const DashboardLayout = () => {
    useGlobalSocketCacheSync();

    const { teams } = useTeamData();
    const location = useLocation();
    const panel = sidebarPanelFor(location.pathname);
    const isRailViewport = useMedia(RAIL_VIEWPORT_QUERY);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [globalSearchBreadcrumb, setGlobalSearchBreadcrumb] = useState<DashboardGlobalSearchBreadcrumb | null>(null);
    const [sidebarCollapsedOverride, setSidebarCollapsedOverride] = useState(false);
    const [sidebarCollapsedPreference, setSidebarCollapsedPreference] = useState(() => {
        return readStoredString(SIDEBAR_COLLAPSED_KEY) === 'true';
    });
    const workspaceChromeState = useSyncExternalStore(
        subscribeToDashboardWorkspaceChromeState,
        getDashboardWorkspaceChromeState,
        getDashboardWorkspaceChromeState
    );

    const headerHidden = workspaceChromeState.headerHidden;
    const collapseRequested = sidebarCollapsedOverride || sidebarCollapsedPreference;
    const collapsed = collapseRequested && isRailViewport;

    const sidePanelOpen = useDashboardSidePanelStore((state) => state.openPanel !== null);

    const railHidden = headerHidden || (sidePanelOpen && isRailViewport);

    let rail: SidebarRailState = 'expanded';
    if (railHidden) {
        rail = 'hidden';
    } else if (collapsed) {
        rail = 'collapsed';
    }

    useTip('dashboard-sidebar-collapse', {
        enabled: !railHidden
    });

    // What the reader chooses wins over a page's own request (the AI page collapses the rail).
    const setSidebarCollapsed = useCallback((next: boolean) => {
        writeStoredString(SIDEBAR_COLLAPSED_KEY, String(next));
        setSidebarCollapsedPreference(next);

        if (!next) {
            setSidebarCollapsedOverride(false);
        }
    }, []);

    const expandSidebar = useCallback(() => setSidebarCollapsed(false), [setSidebarCollapsed]);
    const toggleSidebar = useCallback(() => setSidebarCollapsed(!collapsed), [collapsed, setSidebarCollapsed]);

    useEffect(() => {
        setGlobalSearchBreadcrumb(null);
        setSidebarOpen(false);
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
        <>
            <AIPageExitWidgetBridge />
            {/* Pollium's chrome: the navigation sits on the canvas and the page on one surface,
                inset 8px with a 16px corner from 64rem up, and edge to edge below. */}
            <main className='flex h-dvh flex-row bg-background'>
                <TeamCreatorModal isRequired={teams.length === 0} />
                <JoinTeamModal />

                <div
                    className={cn(
                        'fixed inset-0 z-[99] hidden bg-canvas/80',
                        sidebarOpen && 'max-lg:block'
                    )}
                    onClick={() => setSidebarOpen(false)}
                />

                <aside
                    data-rail={rail}
                    inert={railHidden || (!isRailViewport && !sidebarOpen)}
                    className={cn(
                        'app-sidebar relative z-[100] flex h-dvh shrink-0 flex-col overflow-hidden pt-5 transition-[width] duration-[420ms] ease-out-fluid',
                        'max-lg:fixed max-lg:top-0 max-lg:left-0 max-lg:w-68 max-lg:max-w-[85vw] max-lg:bg-dashboard-surface max-lg:pt-3 max-lg:transition-transform max-lg:[backdrop-filter:var(--glass-backdrop)]',
                        {
                            expanded: 'lg:w-60',
                            collapsed: 'lg:w-16',
                            hidden: 'lg:w-0'
                        }[rail],
                        sidebarOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full'
                    )}
                >
                    <div className='hidden shrink-0 justify-end px-3 pb-1 max-lg:flex'>
                        <Tooltip>
                            <Button
                                isIconOnly
                                variant='ghost'
                                className='rounded-lg text-muted hover:bg-foreground/6 hover:text-foreground'
                                aria-label='Close navigation'
                                onPress={() => setSidebarOpen(false)}
                            >
                                <X size={18} />
                            </Button>
                            <Tooltip.Content placement='bottom'>Close navigation</Tooltip.Content>
                        </Tooltip>
                    </div>

                    <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] px-3 pb-3'>
                        <AppNav
                            active={panel === 'app'}
                            collapsed={collapsed}
                            setSidebarOpen={setSidebarOpen}
                            onExpandSidebar={expandSidebar}
                        />
                        <SettingsNav active={panel === 'settings'} collapsed={collapsed} />
                        <SecretKeysNav active={panel === 'secret-keys'} collapsed={collapsed} />
                        <TrajectoriesNav active={panel === 'trajectories'} collapsed={collapsed} />
                        <AINav active={panel === 'ai'} collapsed={collapsed} />
                    </div>

                    <div
                        className={cn(
                            'flex flex-col gap-2 px-3 pb-3 empty:hidden',
                            collapsed && 'items-center'
                        )}
                    >
                        <UserMenuPopover
                            onSettingsClick={handleSettingsClick}
                            onSignOut={handleSignOut}
                            isSigningOut={isSigningOut}
                            collapsed={collapsed}
                        />
                    </div>
                </aside>

                <div className='flex min-w-0 flex-1 lg:p-2'>
                    <div className='relative flex min-w-0 flex-1 flex-col overflow-hidden lg:rounded-2xl dark:bg-background'>
                        {!headerHidden && (
                            <DashboardHeader
                                setSidebarOpen={setSidebarOpen}
                                isSidebarCollapsed={collapsed}
                                onToggleSidebar={toggleSidebar}
                                globalSearchBreadcrumb={globalSearchBreadcrumb}
                            />
                        )}

                        <Scrollable className='page-view relative min-h-0 flex-1'>
                            <TrajectoryUploaderContainer>
                                {/* A new page is a new outlet, as it was under the old fade: its state starts over. */}
                                <div key={dashboardPageKey(location.pathname)} className='h-full'>
                                    <Outlet context={outletContext} />
                                </div>
                            </TrajectoryUploaderContainer>
                        </Scrollable>

                        {!headerHidden && <DashboardTabBar />}
                    </div>
                </div>

                <DashboardSidePanel />

            </main>
        </>
    );
};

export default DashboardLayout;
