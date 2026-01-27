import type { RouteGroup } from './types';
import Canvas from '@/modules/canvas/presentation/pages/protected/Canvas';
import DashboardPage from '@/modules/dashboard/presentation/pages/Dashboard';
import SSHConnectionsListing from '@/modules/ssh/presentation/pages/protected/SSHConnectionsListing';
import SSHFileExplorer from '@/modules/ssh/presentation/pages/protected/SSHFileExplorer';
import MyTeam from '@/modules/team/presentation/pages/protected/MyTeam';
import HeadlessRasterizerView from '@/modules/raster/presentation/pages/protected/HeadlessRasterizerView';
import Messages from '@/modules/chat/presentation/pages/protected/Messages';
import PluginListing from '@/modules/plugins/presentation/pages/protected/PluginListing';
import Plugins from '@/modules/plugins/presentation/pages/protected/Plugins';
import AnalysisConfigsListing from '@/modules/analysis/presentation/pages/protected/AnalysisConfigsListing';
import TrajectoriesListing from '@/modules/trajectory/presentation/pages/protected/TrajectoriesListing';
import SimulationCellsListing from '@/modules/simulation-cell/presentation/pages/protected/SimulationCellsListing';
import {
    GeneralPage,
    AuthenticationPage,
    ThemePage,
    NotificationsPage,
    SessionsPage,
    IntegrationsPage,
    DataExportPage,
    AdvancedPage
} from '@/modules/settings/presentation/pages/protected';
import Clusters from '@/modules/clusters/presentation/pages/protected/Clusters';
import SignIn from '@/modules/auth/presentation/pages/guest/SignIn';
import TeamInvitationPage from '@/modules/team-invitation/presentation/pages/guest/TeamInvitationPage';
import OAuthCallback from '@/modules/auth/presentation/pages/guest/OAuthCallback';
import Containers from '@/modules/container/presentation/pages/protected/Containers';
import ContainerDetails from '@/modules/container/presentation/pages/protected/ContainerDetails';
import CreateContainer from '@/modules/container/presentation/pages/protected/CreateContainer';
import PluginBuilder from '@/modules/plugins/presentation/pages/protected/PluginBuilder';
import PerAtomViewer from '@/modules/trajectory/presentation/pages/protected/PerAtomViewer';
import ManageRoles from '@/modules/team-role/presentation/pages/protected/ManageRoles';

export const routesConfig: RouteGroup = {
    public: [
        {
            path: '/canvas/:trajectoryId/',
            component: Canvas,
        },
        {
            path: '/raster/:trajectoryId',
            component: HeadlessRasterizerView,
        },
        {
            path: '/team-invitation/:token',
            component: TeamInvitationPage,
        },
        {
            path: '/auth/oauth/success',
            component: OAuthCallback,
        },
    ],

    protected: [
        {
            path: '/dashboard',
            component: DashboardPage,
            requiresLayout: true,
        },
        {
            path: '/dashboard/clusters',
            component: Clusters,
            requiresLayout: true,
        },
        {
            path: '/dashboard/my-team',
            component: MyTeam,
            requiresLayout: true,
        },
        {
            path: '/dashboard/manage-roles',
            component: ManageRoles,
            requiresLayout: true,
        },
        {
            path: '/dashboard/containers',
            component: Containers,
            requiresLayout: true,
        },
        {
            path: '/dashboard/containers/new',
            component: CreateContainer,
            requiresLayout: true,
        },
        {
            path: '/dashboard/containers/:id',
            component: ContainerDetails,
            requiresLayout: true,
        },
        {
            path: '/dashboard/trajectories/list',
            component: TrajectoriesListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/simulation-cells/list',
            component: SimulationCellsListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/analysis-configs/list',
            component: AnalysisConfigsListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/plugins/list',
            component: Plugins,
            requiresLayout: true,
        },
        {
            path: '/dashboard/plugins/builder',
            component: PluginBuilder,
            requiresLayout: false
        },
        {
            path: '/dashboard/plugins/:pluginSlug/listing/:listingSlug',
            component: PluginListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginSlug/listing/:listingSlug',
            component: PluginListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/import/:connectionId',
            component: SSHFileExplorer,
            requiresLayout: true
        },
        {
            path: '/dashboard/ssh-connections',
            component: SSHConnectionsListing,
            requiresLayout: true,
        },
        {
            path: '/dashboard/ssh-connections/:connectionId/file-explorer',
            component: SSHFileExplorer,
            requiresLayout: true,
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/atoms/:exposureId',
            component: PerAtomViewer,
            requiresLayout: true,
        },
        {
            path: '/dashboard/messages/',
            component: Messages,
            requiresLayout: true,
        },
        {
            path: '/dashboard/settings/general',
            component: GeneralPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/authentication',
            component: AuthenticationPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/theme',
            component: ThemePage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/notifications',
            component: NotificationsPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/sessions',
            component: SessionsPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/integrations',
            component: IntegrationsPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/data-export',
            component: DataExportPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
        {
            path: '/dashboard/settings/advanced',
            component: AdvancedPage,
            requiresLayout: true,
            requiresSettingsLayout: true,
        },
    ],

    guest: [
        {
            path: '/auth/sign-in',
            component: SignIn,
        },
    ],
};
