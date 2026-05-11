import './SidebarNavigation.css';
import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationIconKey, DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import ClusterCredentialsModal from '@/modules/cluster/components/ClusterCredentialsModal';
import useSidebarClusters from '@/modules/cluster/hooks/use-sidebar-clusters';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import Box from '@/shared/presentation/primitives/Box';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useMemo } from 'react';
import {
    ArrowUpDown,
    BarChart3,
    BookOpen,
    Box as CubeIcon,
    FileText,
    KeyRound,
    LayoutGrid,
    Lock,
    MessageCircle,
    Paintbrush,
    Server,
    Sparkles,
    Users,
    Workflow
} from 'lucide-react';
import { useLocation, useSearchParams, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { DashboardNavigationItem } from '@/app/routes/metadata';
interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    collapsed?: boolean;
    onExpandSidebar?: () => void;
}

interface IconPair {
    inactive: LucideIcon;
    active: LucideIcon;
}

const DASHBOARD_NAVIGATION_ICONS: Record<DashboardNavigationIconKey, IconPair> = {
    [DashboardNavigationIconKey.AI]: { inactive: Sparkles, active: Sparkles },
    [DashboardNavigationIconKey.Containers]: { inactive: CubeIcon, active: CubeIcon },
    [DashboardNavigationIconKey.Dashboard]: { inactive: LayoutGrid, active: LayoutGrid },
    [DashboardNavigationIconKey.Import]: { inactive: ArrowUpDown, active: ArrowUpDown },
    [DashboardNavigationIconKey.Latex]: { inactive: FileText, active: FileText },
    [DashboardNavigationIconKey.ManageRoles]: { inactive: KeyRound, active: KeyRound },
    [DashboardNavigationIconKey.Messages]: { inactive: MessageCircle, active: MessageCircle },
    [DashboardNavigationIconKey.MyTeam]: { inactive: Users, active: Users },
    [DashboardNavigationIconKey.Notebooks]: { inactive: BookOpen, active: BookOpen },
    [DashboardNavigationIconKey.Plugins]: { inactive: Workflow, active: Workflow },
    [DashboardNavigationIconKey.SecretKeys]: { inactive: Lock, active: Lock },
    [DashboardNavigationIconKey.Whiteboards]: { inactive: Paintbrush, active: Paintbrush }
};

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
    const isAnalysisPluginListingRoute = pathname.includes('/dashboard/plugins/') && pathname.includes('/listing');

    const handleNavigate = (to: string) => {
        navigate(to);
        setSidebarOpen(false);
    };

    const isSelected = (to: string) => {
        let selected = pathname.startsWith(to);
        if (to === '/dashboard') {
            selected = pathname === to;
        }

        return selected;
    };

    const canAccess = (item: DashboardNavigationItem): boolean => {
        const permissionMode = item.permissionMode === RoutePermissionMode.All ? 'all' : 'any';

        return canAccessPermissions(item.requiredPermissions, permissionMode);
    };

    const trajectoriesSubItems = useMemo(() => [
        {
            label: 'View All',
            isSelected: pathname === '/dashboard/trajectories/list',
            onClick: () => {
                navigate('/dashboard/trajectories/list');
                setSidebarOpen(false);
            }
        },
        {
            label: 'Artifacts',
            isSelected: pathname === '/dashboard/trajectories/artifacts',
            onClick: () => {
                navigate('/dashboard/trajectories/artifacts');
                setSidebarOpen(false);
            }
        },
        {
            label: 'Simulation Cells',
            isSelected: pathname === '/dashboard/simulation-cells/list',
            onClick: () => {
                navigate('/dashboard/simulation-cells/list');
                setSidebarOpen(false);
            }
        }
    ], [pathname, navigate, setSidebarOpen]);

    const analysisSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin'),
            onClick: () => {
                navigate('/dashboard/analysis-configs/list');
                setSidebarOpen(false);
            }
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
                        onClick: () => {
                            navigate(`/dashboard/plugins/${plugin._id}/exposure/${exposure.exposureId}/listing`);
                            setSidebarOpen(false);
                        }
                    }))
                };
            })
    ], [pathname, searchParams, navigate, setSidebarOpen, plugins]);

    const clustersSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/clusters',
            onClick: () => {
                navigate('/dashboard/clusters');
                setSidebarOpen(false);
            }
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
                },
                {
                    label: 'Explore Mongo Documents',
                    onClick: () => sidebarClusters.handleExploreMongo(cluster)
                },
                {
                    label: 'Explore Redis Data',
                    onClick: () => sidebarClusters.handleExploreRedis(cluster)
                },
                {
                    label: 'Explore MinIO',
                    onClick: () => sidebarClusters.handleExploreMinio(cluster)
                }
            ]
        }))
    ], [pathname, navigate, setSidebarOpen, sidebarClusters]);

    const canAccessTrajectories = canAccess({
        label: '',
        path: '',
        icon: undefined,
        requiredPermissions: ['trajectory:read']
    });
    const canAccessAnalysis = canAccess({
        label: '',
        path: '',
        icon: undefined,
        requiredPermissions: ['analysis:read']
    });

    const renderNavItem = (item: DashboardNavigationItem) => {
        const isAllowed = canAccess(item);
        const iconPair = item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon] : null;
        let onClick: (() => void) | undefined;
        if (isAllowed) {
            onClick = () => handleNavigate(item.path);
        }

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
                    onClick={onClick}
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
            {MAIN_NAVIGATION_ITEMS.map(renderNavItem)}

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

            {SECONDARY_NAVIGATION_ITEMS.map(renderNavItem)}

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
