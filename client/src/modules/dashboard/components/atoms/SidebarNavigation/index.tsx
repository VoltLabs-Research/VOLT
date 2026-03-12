import './SidebarNavigation.css';
import ClusterCredentialsModal from '@/modules/cluster/components/organisms/ClusterCredentialsModal';
import ClusterRemoteAccessPasswordModal from '@/modules/cluster/components/organisms/ClusterRemoteAccessPasswordModal';
import ClusterRemoteExplorerModal from '@/modules/cluster/components/organisms/ClusterRemoteExplorerModal';
import ClusterRemoteTerminal from '@/modules/cluster/components/organisms/ClusterRemoteTerminal';
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
import { TbCube3dSphere, TbFileTypePdf } from 'react-icons/tb';
import { PiUserPlus, PiPaintBrushBold } from 'react-icons/pi';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IconType } from 'react-icons';

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    collapsed?: boolean;
    onExpandSidebar?: () => void;
};

interface NavItem {
    label: string;
    icon: IconType;
    to: string;
    requiredPermissions?: string[];
    permissionMode?: PermissionMode;
    disabledReason?: string;
};

enum PermissionMode {
    Any = 'any',
    All = 'all'
};

const MAIN_NAV_ITEMS: NavItem[] = [
    {
        label: 'Dashboard',
        icon: RiHomeSmile2Fill,
        to: '/dashboard'
    },
    {
        label: 'Containers',
        icon: IoCubeOutline,
        to: '/dashboard/containers',
        requiredPermissions: ['container:read'],
        disabledReason: 'You do not have permission to view containers.'
    },
    {
        label: 'Notebooks',
        icon: IoBookOutline,
        to: '/dashboard/notebooks',
        requiredPermissions: ['plugin:read'],
        disabledReason: 'You do not have permission to view notebooks.'
    },
    {
        label: 'LaTeX',
        icon: TbFileTypePdf,
        to: '/dashboard/latex',
        requiredPermissions: ['latex:read'],
        disabledReason: 'You do not have permission to view LaTeX documents.'
    }
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
    {
        label: 'Whiteboards',
        icon: PiPaintBrushBold,
        to: '/dashboard/whiteboards',
        requiredPermissions: ['whiteboard:read'],
        disabledReason: 'You do not have permission to view whiteboards.'
    },
    {
        label: 'Plugins',
        icon: GoWorkflow,
        to: '/dashboard/plugins/list',
        requiredPermissions: ['plugin:read'],
        disabledReason: 'You do not have permission to view plugins.'
    },
    {
        label: 'Messages',
        icon: CiChat1,
        to: '/dashboard/messages'
    },
    {
        label: 'Volt AI',
        icon: MdAutoAwesome,
        to: '/dashboard/ai',
        requiredPermissions: ['ai-conversation:read'],
        disabledReason: 'You do not have permission to access Volt AI.'
    },
    {
        label: 'Import',
        icon: MdImportExport,
        to: '/dashboard/ssh-connections',
        requiredPermissions: ['ssh-connection:read'],
        disabledReason: 'You do not have permission to view SSH connections.'
    },
    {
        label: 'My Team',
        icon: IoPeopleOutline,
        to: '/dashboard/my-team',
        requiredPermissions: ['team:read'],
        disabledReason: 'You do not have permission to view team details.'
    },
    {
        label: 'Manage Roles',
        icon: IoKeyOutline,
        to: '/dashboard/manage-roles',
        requiredPermissions: ['team-role:read'],
        disabledReason: 'You do not have permission to view role management.'
    },
    {
        label: 'Secret Keys',
        icon: IoLockClosedOutline,
        to: '/dashboard/secret-keys',
        requiredPermissions: ['team-secret-key:read'],
        disabledReason: 'You do not have permission to view secret keys.'
    }
];

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

    const canAccess = (item: NavItem): boolean => {
        return canAccessPermissions(item.requiredPermissions, item.permissionMode);
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
        icon: TbCube3dSphere,
        to: '',
        requiredPermissions: ['trajectory:read']
    });
    const canAccessAnalysis = canAccess({
        label: '',
        icon: IoAnalytics,
        to: '',
        requiredPermissions: ['analysis:read']
    });

    const renderNavItem = (item: NavItem) => {
        const isAllowed = canAccess(item);
        let onClick: (() => void) | undefined;
        if (isAllowed) {
            onClick = () => handleNavigate(item.to);
        }

        const content = (
            <Container className='sidebar-nav-item-wrapper'>
                <SidebarNavItem
                    label={item.label}
                    icon={item.icon}
                    isSelected={isSelected(item.to)}
                    onClick={onClick}
                    disabled={!isAllowed}
                />
            </Container>
        );

        return (
            <Tooltip
                key={item.to}
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
            {MAIN_NAV_ITEMS.map(renderNavItem)}

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

            <SidebarExpandableSection
                label='Clusters'
                icon={HiOutlineServer}
                isActive={pathname.includes('/dashboard/clusters')}
                subItems={clustersSubItems}
                onRequestSidebarExpand={onExpandSidebar}
            />

            {SECONDARY_NAV_ITEMS.map(renderNavItem)}

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
                    <ClusterRemoteAccessPasswordModal
                        teamCluster={sidebarClusters.remoteAccessRequest?.teamCluster ?? null}
                        target={sidebarClusters.remoteAccessRequest?.target ?? null}
                        onSubmit={sidebarClusters.submitRemoteAccessRequest}
                        onClose={() => sidebarClusters.setRemoteAccessRequest(null)}
                    />
                    <ClusterRemoteTerminal
                        teamCluster={sidebarClusters.remoteTerminal?.teamCluster ?? null}
                        session={sidebarClusters.remoteTerminal?.session ?? null}
                        onClose={sidebarClusters.closeRemoteTerminal}
                    />
                    <ClusterRemoteExplorerModal
                        teamCluster={sidebarClusters.remoteExplorer?.teamCluster ?? null}
                        target={sidebarClusters.remoteExplorer?.target ?? null}
                        session={sidebarClusters.remoteExplorer?.session ?? null}
                        onClose={sidebarClusters.closeRemoteExplorer}
                        listEntries={sidebarClusters.listRemoteExplorerEntries}
                        getNode={sidebarClusters.getRemoteExplorerNode}
                    />
                </>
            )}
        </nav>
    );
};

export default SidebarNavigation;
