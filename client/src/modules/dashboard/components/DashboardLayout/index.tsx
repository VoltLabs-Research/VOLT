import {
    Button,
    Tooltip,
    cn
} from '@heroui/react';
import AppNav from '@/modules/dashboard/components/AppNav';
import DashboardHeader from '@/modules/dashboard/components/DashboardHeader';
import DashboardBottomBar from '@/modules/dashboard/components/DashboardBottomBar';
import SettingsNav from '@/modules/dashboard/components/SettingsNav';
import DashboardSidePanel from '@/modules/dashboard/components/DashboardSidePanel';
import { useDashboardSidePanelStore } from '@/modules/dashboard/store/use-side-panel-store';
import {
    SIDEBAR_MATCHED_WIDTH_CLASS,
    SIDEBAR_RESTING_WIDTH_CLASS
} from '@/modules/dashboard/utils/sidebar-width';
import ActivityDrawer from '@/modules/dashboard/components/ActivityDrawer';
import PresenceDrawer from '@/modules/dashboard/components/PresenceDrawer';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import useUserSessionActions from '@/modules/auth/hooks/use-user-session-actions';
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
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTip from '@/shared/tips/use-tip';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { usePrefersReducedMotion } from '@/shared/ui/hooks/use-prefers-reduced-motion';
import { panelFor } from '@/app/navigation/panels';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type {
    DashboardGlobalSearchBreadcrumb,
    DashboardHeaderContext
} from '@/modules/dashboard/hooks/use-dashboard-header-context';

type SidebarRailState = 'expanded' | 'collapsed' | 'hidden';

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
const RAIL_VIEWPORT_QUERY = '(min-width: 1024.05px)';

const DashboardLayout = () => {
    useGlobalSocketCacheSync();

    const { teams } = useTeamData();
    const location = useLocation();
    const panel = panelFor(location.pathname);
    const prefersReducedMotion = usePrefersReducedMotion();
    const isRailViewport = useMedia(RAIL_VIEWPORT_QUERY);
    const { handleSettingsClick, handleSignOut, isSigningOut } = useUserSessionActions();
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
    const collapseRequested = workspaceChromeState.sidebarCollapsed
        || sidebarCollapsedOverride
        || sidebarCollapsedPreference;
    const collapsed = collapseRequested && isRailViewport;

    let rail: SidebarRailState = 'expanded';
    if (headerHidden) {
        rail = 'hidden';
    } else if (collapsed) {
        rail = 'collapsed';
    }

    /*
     * While the right-hand panel is open the expanded rail grows to the same width, so the
     * content sits between two equal columns instead of a narrow rail and a wide panel.
     *
     * Only the expanded rail follows: `collapsed` and `hidden` are deliberate choices by
     * the user (or by a route asking for chrome-free layout), and widening either of those
     * would override that choice rather than balance anything.
     */
    const sidePanelOpen = useDashboardSidePanelStore((state) => state.openPanel !== null);
    const expandedRailWidthClass = sidePanelOpen
        ? SIDEBAR_MATCHED_WIDTH_CLASS
        : SIDEBAR_RESTING_WIDTH_CLASS;

    useTip('dashboard-sidebar-collapse', {
        enabled: !headerHidden
    });

    const expandSidebar = useCallback(() => {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, 'false');
        setSidebarCollapsedPreference(false);
    }, []);

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
        <AIChatProvider>
            <AIPageExitWidgetBridge />
            <main className='flex h-dvh flex-row bg-background'>
                <TeamCreatorModal isRequired={teams.length === 0} />
                <JoinTeamModal />

                <div
                    className={cn(
                        'fixed inset-0 z-[99] hidden bg-[color-mix(in_srgb,var(--overlay)_78%,transparent)] backdrop-blur-[8px] backdrop-saturate-[1.4]',
                        sidebarOpen && 'max-[1024px]:block'
                    )}
                    onClick={() => setSidebarOpen(false)}
                />

                <aside
                    data-rail={rail}
                    inert={headerHidden || (!isRailViewport && !sidebarOpen)}
                    className={cn(
                        'app-sidebar relative z-[100] flex h-dvh shrink-0 flex-col overflow-hidden bg-transparent pt-5 transition-[width] duration-[420ms] ease-out-fluid max-[1024px]:fixed max-[1024px]:top-0 max-[1024px]:left-0 max-[1024px]:border-r max-[1024px]:border-border max-[1024px]:bg-surface max-[1024px]:shadow-[8px_0_32px_rgba(0,0,0,0.3)] max-[1024px]:transition-[transform] max-[1024px]:duration-[250ms]',
                        {
                            expanded: cn('w-[280px]', expandedRailWidthClass),
                            collapsed: 'w-[280px] min-[1024.05px]:w-16',
                            hidden: 'w-[280px] min-[1024.05px]:w-0'
                        }[rail],
                        sidebarOpen ? 'max-[1024px]:translate-x-0' : 'max-[1024px]:-translate-x-full'
                    )}
                >
                    <Tooltip>
                        <Button
                            isIconOnly
                            variant='ghost'
                            className='absolute top-4 right-4 hidden items-center justify-center rounded-md border border-border bg-surface-tertiary max-[1024px]:flex max-[1024px]:size-11 max-[1024px]:p-0'
                            aria-label='Close sidebar'
                            onPress={() => setSidebarOpen(false)}
                        >
                            <X size={20} />
                        </Button>
                        <Tooltip.Content placement='bottom'>Close sidebar</Tooltip.Content>
                    </Tooltip>

                    <div className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] px-3 pt-2 pb-2'>
                        <AppNav
                            active={panel === 'app'}
                            collapsed={collapsed}
                            setSidebarOpen={setSidebarOpen}
                            onExpandSidebar={expandSidebar}
                        />
                        <SettingsNav active={panel === 'settings'} collapsed={collapsed} />
                    </div>

                    <div
                        className={cn(
                            'flex flex-col gap-2 border-t border-border p-0',
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

                <div className='flex h-dvh min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface'>
                    {!headerHidden && (
                        <DashboardHeader
                            setSidebarOpen={setSidebarOpen}
                            globalSearchBreadcrumb={globalSearchBreadcrumb}
                        />
                    )}

                    <div className='relative min-h-0 flex-1 overflow-y-auto'>
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
                </div>

                <DashboardSidePanel />

                <ActivityDrawer />
                <PresenceDrawer />
            </main>
        </AIChatProvider>
    );
};

export default DashboardLayout;
