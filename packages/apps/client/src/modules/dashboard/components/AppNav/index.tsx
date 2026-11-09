import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DASHBOARD_NAVIGATION_ICONS } from '@/app/routes/navigation-icons';
import { DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import NavTreeSection from '@/modules/dashboard/components/AppNav/NavTreeSection';
import useSidebarClusters from '@/modules/cluster/hooks/use-sidebar-clusters';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import useDefaultSettingsPath from '@/modules/dashboard/hooks/use-default-settings-path';
import { TRAJECTORIES_LIST_PATH } from '@/modules/dashboard/utils/sidebar-panels';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import NavItem from '@/shared/ui/components/NavItem';
import SidebarPanel from '@/shared/ui/components/SidebarPanel';
import { Tooltip } from '@heroui/react';
import { BarChart3, BookOpen, Box as CubeIcon, Server, Settings, Workflow } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { DashboardNavigationItem } from '@/app/routes/metadata';
import type { NavTreeNode } from '@/modules/dashboard/components/AppNav/NavTreeSection';

interface AppNavProps {
    active: boolean;
    collapsed: boolean;
    setSidebarOpen: (status: boolean) => void;
    onExpandSidebar: () => void;
}

const MAIN_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Main);
const SECONDARY_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Secondary);

const DEFAULT_PERMISSION_DENIED_REASON = 'You do not have permission to access this section.';
const DOCS_URL = 'https://docs.voltcloud.dev';
const ANALYSIS_PATH = '/dashboard/analysis';

const AppNav = ({ active, collapsed, setSidebarOpen, onExpandSidebar }: AppNavProps) => {
    const { pathname } = useLocation();
    const { canAccess: canAccessPermissions } = useTeamPermissions();
    const sidebarClusters = useSidebarClusters(setSidebarOpen);
    const visibleNavigationItems = useVisibleNavigationItems();
    const defaultSettingsPath = useDefaultSettingsPath();
    const isAnalysisPluginListingRoute = pathname.includes('/dashboard/plugins/') && pathname.includes('/listing');

    const isSelected = (to: string) => {
        if (to === '/dashboard') {
            return pathname === to;
        }

        return pathname.startsWith(to);
    };

    const canAccess = (item: DashboardNavigationItem): boolean => {
        const permissionMode = item.permissionMode === RoutePermissionMode.All ? 'all' : 'any';

        return canAccessPermissions(item.requiredPermissions, permissionMode);
    };

    const clustersItems = useMemo<NavTreeNode[]>(() => [
        {
            label: 'View all',
            to: '/dashboard/clusters',
            isSelected: pathname === '/dashboard/clusters'
        },
        ...sidebarClusters.clusters.map((cluster) => ({
            label: cluster.name,
            isSelected: pathname === `/dashboard/clusters/${cluster._id}`,
            children: [
                {
                    label: 'Monitor',
                    onClick: () => sidebarClusters.handleMonitor(cluster)
                }
            ]
        }))
    ], [pathname, sidebarClusters]);

    const pluginsItems = useMemo<NavTreeNode[]>(() => [
        {
            label: 'Installed',
            to: '/dashboard/plugins/list',
            isSelected: pathname === '/dashboard/plugins/list'
        },
        {
            label: 'Marketplace',
            to: '/dashboard/plugins/marketplace',
            isSelected: pathname === '/dashboard/plugins/marketplace'
        }
    ], [pathname]);

    const canAccessTrajectories = canAccessPermissions(['trajectory:read']);
    const canAccessAnalysis = canAccessPermissions(['analysis:read']);
    const canAccessPlugins = canAccessPermissions(['plugin:read']);

    // Analysis is one page; the run reports and the older listing pages keep it selected.
    const analysisActive = pathname.startsWith('/dashboard/analysis') || isAnalysisPluginListingRoute;
    const clustersActive = pathname.includes('/dashboard/clusters');
    const pluginsActive = (pathname.startsWith('/dashboard/plugins') && !isAnalysisPluginListingRoute)
        || pathname.startsWith('/plugins/builder');


    const handleOpenDocs = () => window.open(DOCS_URL, '_blank', 'noopener,noreferrer');

    const renderRow = (key: string, tooltip: string, isTooltipDisabled: boolean, row: ReactNode) => (
        <Tooltip key={key} isDisabled={isTooltipDisabled}>
            <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                {row}
            </Tooltip.Trigger>
            <Tooltip.Content placement='right'>{tooltip}</Tooltip.Content>
        </Tooltip>
    );

    const renderNavItem = (item: DashboardNavigationItem) => {
        const isAllowed = canAccess(item);
        const iconPair = item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon] : null;

        if (!iconPair) {
            return null;
        }

        const selected = isSelected(item.path);
        const Icon = selected ? iconPair.active : iconPair.inactive;
        const tooltip = isAllowed ? item.label : (item.disabledReason ?? DEFAULT_PERMISSION_DENIED_REASON);

        return renderRow(item.path, tooltip, isAllowed && !collapsed, (
            <NavItem
                label={item.label}
                icon={Icon}
                collapsed={collapsed}
                to={isAllowed ? item.path : undefined}
                isActive={selected}
                isDisabled={!isAllowed}
            />
        ));
    };

    return (
        <SidebarPanel name='app' label='Main navigation' active={active}>
            {visibleNavigationItems(MAIN_NAVIGATION_ITEMS).map(renderNavItem)}

            {/* Trajectories is a section: its pages take over the sidebar (TrajectoriesNav). */}
            {renderRow(
                'trajectories',
                canAccessTrajectories ? 'Trajectories' : 'You do not have permission to view trajectories.',
                canAccessTrajectories && !collapsed,
                (
                    <NavItem
                        label='Trajectories'
                        icon={CubeIcon}
                        collapsed={collapsed}
                        to={canAccessTrajectories ? TRAJECTORIES_LIST_PATH : undefined}
                        isDisabled={!canAccessTrajectories}
                    />
                )
            )}

            {renderRow(
                'analysis',
                canAccessAnalysis ? 'Analysis' : 'You do not have permission to view analysis.',
                canAccessAnalysis && !collapsed,
                (
                    <NavItem
                        label='Analysis'
                        icon={BarChart3}
                        collapsed={collapsed}
                        to={canAccessAnalysis ? ANALYSIS_PATH : undefined}
                        isActive={analysisActive}
                        isDisabled={!canAccessAnalysis}
                    />
                )
            )}

            <NavTreeSection
                label='Plugins'
                icon={Workflow}
                isActive={pluginsActive}
                items={pluginsItems}
                collapsed={collapsed}
                isDisabled={!canAccessPlugins}
                tooltip={canAccessPlugins ? 'Plugins' : 'You do not have permission to view plugins.'}
                isTooltipDisabled={canAccessPlugins && !collapsed}
                onRequestExpand={onExpandSidebar}
            />

            {/* The cluster of a backend in this tab is the tab itself (app/routes/types.ts, requiresMachine). */}
            {!localStackMode.isEnabled() && (
                <NavTreeSection
                    label='Clusters'
                    icon={Server}
                    isActive={clustersActive}
                    items={clustersItems}
                    collapsed={collapsed}
                    tooltip='Clusters'
                    isTooltipDisabled={!collapsed}
                    onRequestExpand={onExpandSidebar}
                />
            )}

            {visibleNavigationItems(SECONDARY_NAVIGATION_ITEMS).map(renderNavItem)}

            <span className='flex-1' />

            {renderRow('settings', 'Settings', !collapsed, (
                <NavItem
                    label='Settings'
                    icon={Settings}
                    collapsed={collapsed}
                    to={defaultSettingsPath}
                />
            ))}

            {renderRow('docs', 'Read the docs', !collapsed, (
                <NavItem
                    label='Read the docs'
                    icon={BookOpen}
                    collapsed={collapsed}
                    onClick={handleOpenDocs}
                />
            ))}

        </SidebarPanel>
    );
};

export default AppNav;
