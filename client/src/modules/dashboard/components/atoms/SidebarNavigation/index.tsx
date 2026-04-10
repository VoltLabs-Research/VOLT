import './SidebarNavigation.css';
import { getDashboardNavigationItems } from '@/app/routes/metadata';
import { DashboardNavigationIconKey, DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import ClusterCredentialsModal from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import UpdateClusterModal from '@/modules/cluster/components/organisms/UpdateClusterModal';
import useSidebarClusters from '@/modules/cluster/hooks/use-sidebar-clusters';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/plugin/use-plugin-catalog';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing/listing-exposures';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import Tooltip from '@/shared/presentation/components/Tooltip';
import TeamSelector from '@/modules/team/components/atoms/TeamSelector';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useMemo } from 'react';
import { CiChat1 } from 'react-icons/ci';
import { GoWorkflow } from 'react-icons/go';
import { HiOutlineServer } from 'react-icons/hi';
import { IoIosAdd } from 'react-icons/io';
import { IoAnalytics, IoBookOutline, IoCubeOutline, IoKeyOutline, IoLockClosedOutline, IoPeopleOutline } from 'react-icons/io5';
import { MdAutoAwesome, MdImportExport } from 'react-icons/md';
import { RiHomeSmile2Fill } from 'react-icons/ri';
import { TbAtom2, TbCube3dSphere, TbFileTypePdf } from 'react-icons/tb';
import { PiUserPlus, PiPaintBrushBold } from 'react-icons/pi';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IconType } from 'react-icons';
import type { DashboardNavigationItem } from '@/app/routes/metadata';

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    collapsed?: boolean;
    onExpandSidebar?: () => void;
};

const DASHBOARD_NAVIGATION_ICONS: Record<DashboardNavigationIconKey, IconType> = {
    [DashboardNavigationIconKey.AI]: MdAutoAwesome,
    [DashboardNavigationIconKey.Containers]: IoCubeOutline,
    [DashboardNavigationIconKey.Dashboard]: RiHomeSmile2Fill,
    [DashboardNavigationIconKey.Import]: MdImportExport,
    [DashboardNavigationIconKey.Latex]: TbFileTypePdf,
    [DashboardNavigationIconKey.ManageRoles]: IoKeyOutline,
    [DashboardNavigationIconKey.Messages]: CiChat1,
    [DashboardNavigationIconKey.MyTeam]: IoPeopleOutline,
    [DashboardNavigationIconKey.Notebooks]: IoBookOutline,
    [DashboardNavigationIconKey.Plugins]: GoWorkflow,
    [DashboardNavigationIconKey.SecretKeys]: IoLockClosedOutline,
    [DashboardNavigationIconKey.Whiteboards]: PiPaintBrushBold
};

const MAIN_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Main);
const SECONDARY_NAVIGATION_ITEMS = getDashboardNavigationItems(DashboardNavigationSection.Secondary);

const SidebarNavigation = ({ setSidebarOpen, collapsed = false, onExpandSidebar }: SidebarNavigationProps) => {
    const { searchParams } = useSearchParamsState();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { canAccess: canAccessPermissions } = useTeamPermissions();
    const { plugins } = usePluginSelectors();
    useEnsurePluginCatalogLoaded();
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

                return {
                    plugin,
                    exposures
                };
            })
            .filter(({ exposures }) => exposures.length > 0)
            .map(({ plugin, exposures }) => {
                const pluginLabel = plugin.listingExposures?.pluginName || plugin.modifier?.name || plugin._id;

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
                    label: 'Update Cluster',
                    onClick: () => sidebarClusters.handleUpdateCluster(cluster)
                },
                {
                    label: 'Open Terminal',
                    onClick: () => sidebarClusters.handleOpenTerminal(cluster)
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
    const canAccessLammps = canAccess({
        label: '',
        path: '',
        icon: undefined,
        requiredPermissions: ['lammps:read']
    });

    const lammpsSubItems = useMemo(() => [
        {
            label: 'Containers',
            isSelected: pathname === '/dashboard/lammps/containers',
            onClick: () => {
                navigate('/dashboard/lammps/containers');
                setSidebarOpen(false);
            }
        },
        {
            label: 'Scripts',
            isSelected: pathname === '/dashboard/lammps/scripts' || pathname.startsWith('/dashboard/lammps/scripts/'),
            onClick: () => {
                navigate('/dashboard/lammps/scripts');
                setSidebarOpen(false);
            }
        },
        {
            label: 'Exec History',
            isSelected: pathname === '/dashboard/lammps/exec-history',
            onClick: () => {
                navigate('/dashboard/lammps/exec-history');
                setSidebarOpen(false);
            }
        }
    ], [navigate, pathname, setSidebarOpen]);

    const renderNavItem = (item: DashboardNavigationItem) => {
        const isAllowed = canAccess(item);
        const Icon = item.icon ? DASHBOARD_NAVIGATION_ICONS[item.icon] : null;
        let onClick: (() => void) | undefined;
        if (isAllowed) {
            onClick = () => handleNavigate(item.path);
        }

        if (!Icon) {
            return null;
        }

        const content = (
            <Container className='sidebar-nav-item-wrapper'>
                <SidebarNavItem
                    label={item.label}
                    icon={Icon}
                    isSelected={isSelected(item.path)}
                    onClick={onClick}
                    disabled={!isAllowed}
                />
            </Container>
        );

        return (
            <Tooltip
                key={item.path}
                content={item.disabledReason ?? 'You do not have permission to access this section.'}
                placement='right'
                disabled={isAllowed}
            >
                {content}
            </Tooltip>
        );
    };

    return (
        <nav className='sidebar-nav y-auto'>
            {MAIN_NAVIGATION_ITEMS.map(renderNavItem)}

            <Tooltip
                content='You do not have permission to view trajectories.'
                placement='right'
                disabled={canAccessTrajectories}
            >
                <SidebarExpandableSection
                    label='Trajectories'
                    icon={TbCube3dSphere}
                    isActive={pathname.includes('/trajectories') || pathname.includes('/simulation-cells')}
                    subItems={trajectoriesSubItems}
                    disabled={!canAccessTrajectories}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            <Tooltip
                content='You do not have permission to view analysis.'
                placement='right'
                disabled={canAccessAnalysis}
            >
                <SidebarExpandableSection
                    label='Analysis'
                    icon={IoAnalytics}
                    isActive={pathname.includes('/analysis-configs') || isAnalysisPluginListingRoute}
                    subItems={analysisSubItems}
                    disabled={!canAccessAnalysis}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            <Tooltip
                content='You do not have permission to view LAMMPS.'
                placement='right'
                disabled={canAccessLammps}
            >
                <SidebarExpandableSection
                    label='Lammps'
                    icon={TbAtom2}
                    isActive={pathname.startsWith('/dashboard/lammps')}
                    subItems={lammpsSubItems}
                    disabled={!canAccessLammps}
                    onRequestSidebarExpand={onExpandSidebar}
                />
            </Tooltip>

            <SidebarExpandableSection
                label='Clusters'
                icon={HiOutlineServer}
                isActive={pathname.includes('/dashboard/clusters')}
                subItems={clustersSubItems}
                onRequestSidebarExpand={onExpandSidebar}
            />

            {SECONDARY_NAVIGATION_ITEMS.map(renderNavItem)}

            <Divider className={`sidebar-divider ${collapsed ? 'is-hidden' : ''}`} />

            <Container className={`sidebar-team-section ${collapsed ? 'is-hidden' : ''}`}>
                <TeamSelector className='team-select' />
            </Container>

            {!collapsed && (
                <SidebarNavItem
                    label='Create Team'
                    icon={IoIosAdd}
                    commandFor='team-creator-modal'
                    command='show-modal'
                />
            )}

            {!collapsed && (
                <SidebarNavItem
                    label='Join an Existing Team'
                    icon={PiUserPlus}
                    commandFor='join-team-modal'
                    command='show-modal'
                />
            )}

            {!sidebarClusters.isOnClustersRoute && (
                <>
                    <ClusterCredentialsModal
                        teamCluster={sidebarClusters.credentialsCluster}
                        credentials={sidebarClusters.credentials}
                        onReveal={sidebarClusters.revealCredentials}
                    />
                    <UpdateClusterModal
                        teamCluster={sidebarClusters.updateTarget}
                        teamId={sidebarClusters.selectedTeamId}
                        onUpdate={sidebarClusters.requestUpdate}
                        onClose={() => sidebarClusters.setUpdateTarget(null)}
                    />
                </>
            )}
        </nav>
    );
};

export default SidebarNavigation;
