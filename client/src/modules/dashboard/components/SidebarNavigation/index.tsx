import './SidebarNavigation.css';
import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import { DASHBOARD_NAVIGATION_ICONS } from '@/app/routes/navigation-icons';
import ClusterCredentialsModal from '@/modules/cluster/components/ClusterCredentialsModal';
import useSidebarClusters from '@/modules/cluster/hooks/use-sidebar-clusters';
import { getListingRelevantExposures } from '@/modules/plugin/utils/listing/listing-exposures';
import SidebarExpandableSection from '@/shared/ui/components/SidebarExpandableSection';
import SidebarNavItem from '@/shared/ui/components/SidebarNavItem';
import { Box, Tooltip } from '@voltstack/bravais';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useVisibleNavigationItems from '@/modules/dashboard/hooks/use-visible-navigation-items';
import { useCallback, useMemo } from 'react';
import {
    BarChart3,
    Box as CubeIcon,
    Server
} from 'lucide-react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import type { DashboardNavigationItem } from '@/app/routes/metadata';
interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    collapsed?: boolean;
    onExpandSidebar?: () => void;
}

const MAIN_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Main);
const SECONDARY_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Secondary);
const PLUGIN_NAVIGATION_LABEL_COLLATOR = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base'
});

const SidebarNavigation = ({ setSidebarOpen, collapsed = false, onExpandSidebar }: SidebarNavigationProps) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { canAccess: canAccessPermissions } = useTeamPermissions();
    const { plugins } = usePluginSelectors();
    const sidebarClusters = useSidebarClusters(setSidebarOpen);
    const visibleNavigationItems = useVisibleNavigationItems();
    const isAnalysisPluginListingRoute = pathname.includes('/dashboard/plugins/') && pathname.includes('/listing');

    const handleNavigate = useCallback((to: string) => {
        navigate(to);
        setSidebarOpen(false);
    }, [navigate, setSidebarOpen]);

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

    const trajectoriesSubItems = useMemo(() => [
        {
            label: 'View All',
            isSelected: pathname === '/dashboard/trajectories/list',
            onClick: () => handleNavigate('/dashboard/trajectories/list')
        },
        {
            label: 'Artifacts',
            isSelected: pathname === '/dashboard/trajectories/artifacts',
            onClick: () => handleNavigate('/dashboard/trajectories/artifacts')
        },
        {
            label: 'Simulation Cells',
            isSelected: pathname === '/dashboard/simulation-cells/list',
            onClick: () => handleNavigate('/dashboard/simulation-cells/list')
        }
    ], [pathname, handleNavigate]);

    const analysisSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin'),
            onClick: () => handleNavigate('/dashboard/analysis-configs/list')
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
            .map(({ plugin, exposures, pluginLabel }) => {
                return {
                    label: pluginLabel,
                    isSelected: exposures.some((exposure) =>
                        pathname.includes(`/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`)
                    ),
                    subItems: exposures.map((exposure) => ({
                        label: exposure.name,
                        isSelected: pathname.includes(`/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`),
                        onClick: () => handleNavigate(`/dashboard/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`)
                    }))
                };
            })
    ], [pathname, searchParams, handleNavigate, plugins]);

    const clustersSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/clusters',
            onClick: () => handleNavigate('/dashboard/clusters')
        },
        ...sidebarClusters.clusters.map((cluster) => ({
            label: cluster.name,
            isSelected: pathname === `/dashboard/clusters/${cluster._id}`,
            subItems: [
                {
                    label: 'Monitor',
                    onClick: () => sidebarClusters.handleMonitor(cluster)
                },
                {
                    label: 'Reveal Credentials',
                    onClick: () => sidebarClusters.handleRevealCredentials(cluster)
                }
            ]
        }))
    ], [pathname, handleNavigate, sidebarClusters]);

    const canAccessTrajectories = canAccessPermissions(['trajectory:read']);
    const canAccessAnalysis = canAccessPermissions(['analysis:read']);

    const renderNavItem = (item: DashboardNavigationItem) => {
        const isAllowed = canAccess(item);
        const iconPair = item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon] : null;

        if (!iconPair) {
            return null;
        }

        const selected = isSelected(item.path);
        const Icon = selected ? iconPair.active : iconPair.inactive;

        const content = (
            <Box className='sidebar-nav-item-wrapper'>
                <SidebarNavItem
                    label={item.label}
                    icon={Icon}
                    isSelected={selected}
                    onClick={isAllowed ? () => handleNavigate(item.path) : undefined}
                    disabled={!isAllowed}
                />
            </Box>
        );

        const tooltipContent = isAllowed
            ? item.label
            : (item.disabledReason ?? 'You do not have permission to access this section.');
        const tooltipDisabled = isAllowed && !collapsed;

        return (
            <Tooltip
                key={item.path}
                content={tooltipContent}
                placement='right'
                disabled={tooltipDisabled}
            >
                {content}
            </Tooltip>
        );
    };

    const trajectoriesActive = pathname.includes('/trajectories') || pathname.includes('/simulation-cells');
    const analysisActive = pathname.includes('/analysis-configs') || isAnalysisPluginListingRoute;
    const clustersActive = pathname.includes('/dashboard/clusters');

    return (
        <nav className='sidebar-nav y-auto'>
            {visibleNavigationItems(MAIN_NAVIGATION_ITEMS).map(renderNavItem)}

            <Tooltip
                content={canAccessTrajectories ? 'Trajectories' : 'You do not have permission to view trajectories.'}
                placement='right'
                disabled={canAccessTrajectories && !collapsed}
            >
                <SidebarExpandableSection
                    label='Trajectories'
                    icon={CubeIcon}
                    isActive={trajectoriesActive}
                    subItems={trajectoriesSubItems}
                    disabled={!canAccessTrajectories}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            <Tooltip
                content={canAccessAnalysis ? 'Analysis' : 'You do not have permission to view analysis.'}
                placement='right'
                disabled={canAccessAnalysis && !collapsed}
            >
                <SidebarExpandableSection
                    label='Analysis'
                    icon={BarChart3}
                    isActive={analysisActive}
                    subItems={analysisSubItems}
                    disabled={!canAccessAnalysis}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            <Tooltip
                content='Clusters'
                placement='right'
                disabled={!collapsed}
            >
                <SidebarExpandableSection
                    label='Clusters'
                    icon={Server}
                    isActive={clustersActive}
                    subItems={clustersSubItems}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            {visibleNavigationItems(SECONDARY_NAVIGATION_ITEMS).map(renderNavItem)}

            {!sidebarClusters.isOnClustersRoute && (
                <ClusterCredentialsModal
                    teamCluster={sidebarClusters.credentialsCluster}
                    credentials={sidebarClusters.credentials}
                    onReveal={sidebarClusters.revealCredentials}
                />
            )}
        </nav>
    );
};

export default SidebarNavigation;
