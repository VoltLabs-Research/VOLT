import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DASHBOARD_NAVIGATION_ICONS } from '@/app/routes/navigation-icons';
import { DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import NavTreeSection from '@/modules/dashboard/components/AppNav/NavTreeSection';
import useSidebarClusters from '@/modules/cluster/hooks/use-sidebar-clusters';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import NavItem from '@/shared/ui/components/NavItem';
import SidebarPanel from '@/shared/ui/components/SidebarPanel';
import { getListingRelevantExposures } from '@/modules/plugin/utils/listing/listing-exposures';
import { Tooltip } from '@heroui/react';
import { BarChart3, BookOpen, Box as CubeIcon, Server, Settings, Workflow } from 'lucide-react';
import { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
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
const SETTINGS_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Settings);

const PLUGIN_NAVIGATION_LABEL_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base'
});

const DEFAULT_PERMISSION_DENIED_REASON = 'You do not have permission to access this section.';
const DOCS_URL = 'https://docs.voltcloud.dev';

const AppNav = ({ active, collapsed, setSidebarOpen, onExpandSidebar }: AppNavProps) => {
    const [searchParams] = useSearchParams();
    const { pathname } = useLocation();
    const { canAccess: canAccessPermissions } = useTeamPermissions();
    const { plugins } = usePluginSelectors();
    const sidebarClusters = useSidebarClusters(setSidebarOpen);
    const visibleNavigationItems = useVisibleNavigationItems();
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

    const trajectoriesItems = useMemo<NavTreeNode[]>(() => [
        {
            label: 'View All',
            to: '/dashboard/trajectories/list',
            isSelected: pathname === '/dashboard/trajectories/list'
        },
        {
            label: 'Artifacts',
            to: '/dashboard/trajectories/artifacts',
            isSelected: pathname === '/dashboard/trajectories/artifacts'
        },
        {
            label: 'Simulation Cells',
            to: '/dashboard/simulation-cells/list',
            isSelected: pathname === '/dashboard/simulation-cells/list'
        }
    ], [pathname]);

    const analysisItems = useMemo<NavTreeNode[]>(() => [
        {
            label: 'View all',
            to: '/dashboard/analysis-configs/list',
            isSelected: pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin')
        },
        ...plugins
            .map((plugin) => {
                const exposures = getListingRelevantExposures(plugin.exposures);
                const pluginLabel = plugin.listingExposures?.pluginName || plugin.modifier?.name || plugin._id;

                return {
                    plugin,
                    exposures,
                    pluginLabel
                };
            })
            .filter(({ exposures }) => exposures.length > 0)
            .sort((left, right) => PLUGIN_NAVIGATION_LABEL_COLLATOR.compare(left.pluginLabel, right.pluginLabel))
            .map(({ plugin, exposures, pluginLabel }) => ({
                label: pluginLabel,
                isSelected: exposures.some((exposure) =>
                    pathname.includes(`/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`)
                ),
                children: exposures.map((exposure) => ({
                    label: exposure.name,
                    to: `/dashboard/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`,
                    isSelected: pathname.includes(`/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`)
                }))
            }))
    ], [pathname, searchParams, plugins]);

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

    const trajectoriesActive = pathname.includes('/trajectories') || pathname.includes('/simulation-cells');
    const analysisActive = pathname.includes('/analysis-configs') || isAnalysisPluginListingRoute;
    const clustersActive = pathname.includes('/dashboard/clusters');
    /*
     * Excludes the per-plugin listing routes: those belong to Analysis (that tree
     * lists them), and lighting up two sections for one page tells the reader the
     * page lives in both.
     */
    const pluginsActive = (pathname.startsWith('/dashboard/plugins') && !isAnalysisPluginListingRoute)
        || pathname.startsWith('/plugins/builder');

    const settingsItems = visibleNavigationItems(SETTINGS_NAVIGATION_ITEMS);
    const defaultSettingsPath = settingsItems[0]?.path ?? '/dashboard/settings/general';
    const settingsActive = pathname.startsWith('/dashboard/settings');

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

            <NavTreeSection
                label='Trajectories'
                icon={CubeIcon}
                isActive={trajectoriesActive}
                items={trajectoriesItems}
                collapsed={collapsed}
                isDisabled={!canAccessTrajectories}
                tooltip={canAccessTrajectories ? 'Trajectories' : 'You do not have permission to view trajectories.'}
                isTooltipDisabled={canAccessTrajectories && !collapsed}
                onRequestExpand={onExpandSidebar}
            />

            <NavTreeSection
                label='Analysis'
                icon={BarChart3}
                isActive={analysisActive}
                items={analysisItems}
                collapsed={collapsed}
                isDisabled={!canAccessAnalysis}
                tooltip={canAccessAnalysis ? 'Analysis' : 'You do not have permission to view analysis.'}
                isTooltipDisabled={canAccessAnalysis && !collapsed}
                onRequestExpand={onExpandSidebar}
            />

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

            {visibleNavigationItems(SECONDARY_NAVIGATION_ITEMS).map(renderNavItem)}

            <span className='flex-1' />

            {renderRow('settings', 'Settings', !collapsed, (
                <NavItem
                    label='Settings'
                    icon={Settings}
                    collapsed={collapsed}
                    to={defaultSettingsPath}
                    isActive={settingsActive}
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
