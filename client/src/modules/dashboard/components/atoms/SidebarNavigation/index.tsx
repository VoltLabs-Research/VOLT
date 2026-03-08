import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { RiHomeSmile2Fill } from 'react-icons/ri';
import { TbCube3dSphere } from 'react-icons/tb';
import { IoCubeOutline, IoAnalytics, IoPeopleOutline, IoKeyOutline, IoBookOutline, IoLockClosedOutline } from 'react-icons/io5';
import { GoWorkflow } from 'react-icons/go';
import { CiChat1 } from 'react-icons/ci';
import { HiOutlineServer } from 'react-icons/hi';
import { MdAutoAwesome, MdImportExport } from 'react-icons/md';
import { IoIosAdd } from 'react-icons/io';
import type { IconType } from 'react-icons';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import Tooltip from '@/shared/presentation/components/Tooltip';
import TeamSelector from '@/modules/team/components/atoms/TeamSelector';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import usePluginSelectors from '@/modules/plugin/hooks/use-plugin-selectors';
import { useEnsurePluginCatalogLoaded } from '@/modules/plugin/hooks/use-plugin-catalog';
import { getListingRelevantExposures } from '@/modules/plugin/utilities/listing-exposures';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import SidebarExpandableSection from '@/shared/presentation/components/SidebarExpandableSection';
import './SidebarNavigation.css';

type PermissionMode = 'any' | 'all';

interface NavItem {
    label: string;
    icon: IconType;
    to: string;
    requiredPermissions?: string[];
    permissionMode?: PermissionMode;
    disabledReason?: string;
}

const MAIN_NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', icon: RiHomeSmile2Fill, to: '/dashboard' },
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
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
    {
        label: 'Plugins',
        icon: GoWorkflow,
        to: '/dashboard/plugins/list',
        requiredPermissions: ['plugin:read'],
        disabledReason: 'You do not have permission to view plugins.'
    },
    { label: 'Messages', icon: CiChat1, to: '/dashboard/messages' },
    {
        label: 'Volt AI',
        icon: MdAutoAwesome,
        to: '/dashboard/ai',
        requiredPermissions: ['ai-conversation:read'],
        disabledReason: 'You do not have permission to access Volt AI.'
    },
    { label: 'Clusters', icon: HiOutlineServer, to: '/dashboard/clusters' },
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

interface SidebarNavigationProps {
    setSidebarOpen: (status: boolean) => void;
    collapsed?: boolean;
};

const SidebarNavigation = ({ setSidebarOpen, collapsed = false }: SidebarNavigationProps) => {
    const { searchParams } = useSearchParamsState();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { canAccess: canAccessPermissions } = useTeamPermissions();
    const { plugins } = usePluginSelectors();
    useEnsurePluginCatalogLoaded();
    const isAnalysisPluginListingRoute = pathname.includes('/dashboard/plugins/') && pathname.includes('/listing');

    const handleNavigate = (to: string) => {
        navigate(to);
        setSidebarOpen(false);
    };

    const isSelected = (to: string) => 
        to === '/dashboard' ? pathname === to : pathname.startsWith(to);

    const canAccess = (item: NavItem): boolean => {
        return canAccessPermissions(item.requiredPermissions, item.permissionMode);
    };

    const trajectoriesSubItems = useMemo(() => [
        {
            label: 'View All',
            isSelected: pathname === '/dashboard/trajectories/list',
            onClick: () => { navigate('/dashboard/trajectories/list'); setSidebarOpen(false); }
        },
        {
            label: 'Simulation Cells',
            isSelected: pathname === '/dashboard/simulation-cells/list',
            onClick: () => { navigate('/dashboard/simulation-cells/list'); setSidebarOpen(false); }
        }
    ], [pathname, navigate, setSidebarOpen]);

    const analysisSubItems = useMemo(() => [
        {
            label: 'View all',
            isSelected: pathname === '/dashboard/analysis-configs/list' && !searchParams.get('plugin'),
            onClick: () => { navigate('/dashboard/analysis-configs/list'); setSidebarOpen(false); }
        },
        ...plugins
            .map((plugin) => {
                const exposures = getListingRelevantExposures(plugin.exposures);

                return { plugin, exposures };
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

    const canAccessTrajectories = canAccess({ label: '', icon: TbCube3dSphere, to: '', requiredPermissions: ['trajectory:read'] });
    const canAccessAnalysis = canAccess({ label: '', icon: IoAnalytics, to: '', requiredPermissions: ['analysis:read'] });

    return (
        <nav className='sidebar-nav y-auto'>
            {MAIN_NAV_ITEMS.map((item, index) => {
                const isAllowed = canAccess(item);
                const content = (
                    <Container className='sidebar-nav-item-wrapper'>
                        <SidebarNavItem
                            key={index}
                            label={item.label}
                            icon={item.icon}
                            isSelected={isSelected(item.to)}
                            onClick={isAllowed ? () => handleNavigate(item.to) : undefined}
                            disabled={!isAllowed}
                        />
                    </Container>
                );
                return (
                    <Tooltip
                        key={index}
                        content={item.disabledReason ?? 'You do not have permission to access this section.'}
                        placement='right'
                        disabled={isAllowed}
                    >
                        {content}
                    </Tooltip>
                );
            })}

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
                />
            </Tooltip>

            {SECONDARY_NAV_ITEMS.map((item, index) => {
                const isAllowed = canAccess(item);
                const content = (
                    <Container className='sidebar-nav-item-wrapper'>
                        <SidebarNavItem
                            key={index}
                            label={item.label}
                            icon={item.icon}
                            isSelected={isSelected(item.to)}
                            onClick={isAllowed ? () => handleNavigate(item.to) : undefined}
                            disabled={!isAllowed}
                        />
                    </Container>
                );
                return (
                    <Tooltip
                        key={index}
                        content={item.disabledReason ?? 'You do not have permission to access this section.'}
                        placement='right'
                        disabled={isAllowed}
                    >
                        {content}
                    </Tooltip>
                );
            })}

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
        </nav>
    );
};

export default SidebarNavigation;
