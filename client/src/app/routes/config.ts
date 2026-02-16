import { RouteGroup } from './types';
import SignInPage from '@/modules/auth/presentation/components/templates/SignIn';
import OAuthCallbackPage from '@/modules/auth/presentation/components/templates/OAuthCallback';
import GeneralSettings from '@/modules/auth/presentation/components/templates/Settings/GeneralSettings';
import AuthenticationSettings from '@/modules/auth/presentation/components/templates/Settings/AuthenticationSettings';
import ThemeSettings from '@/modules/auth/presentation/components/templates/Settings/ThemeSettings';
import NotificationSettings from '@/modules/auth/presentation/components/templates/Settings/NotificationSettings';
import MyTeamTemplate from '@/modules/team/presentation/components/templates/MyTeam';
import ManageRolesTemplate from '@/modules/team/presentation/components/templates/ManageRoles';
import TeamInvitationTemplate from '@/modules/team/presentation/components/templates/TeamInvitation';
import TrajectoriesListing from '@/modules/trajectory/presentation/components/templates/TrajectoriesListing';
import PerAtomViewer from '@/modules/trajectory/presentation/components/templates/PerAtomViewer';
import CanvasPage from '@/modules/canvas/presentation/components/templates/CanvasPage';
import AnalysesListing from '@/modules/analysis/presentation/components/templates/AnalysesListing';
import SimulationCellsListing from '@/modules/simulation-cell/presentation/components/templates/SimulationCellsListing';
import PluginsListing from '@/modules/plugin/presentation/components/templates/PluginsListing';
import PluginBuilderPage from '@/modules/plugin/presentation/components/templates/PluginBuilderPage';
import PluginListingPage from '@/modules/plugin/presentation/components/templates/PluginListingPage';
import ClustersPage from '@/modules/cluster/presentation/components/templates/ClustersPage';
import ContainersListing from '@/modules/container/presentation/components/templates/ContainersListing';
import ContainerDetailsLayout from '@/modules/container/presentation/components/templates/ContainerDetailsLayout';
import ContainerOverviewPage from '@/modules/container/presentation/pages/ContainerOverviewPage';
import ContainerProcessesPage from '@/modules/container/presentation/pages/ContainerProcessesPage';
import ContainerLogsPage from '@/modules/container/presentation/pages/ContainerLogsPage';
import ContainerStoragePage from '@/modules/container/presentation/pages/ContainerStoragePage';
import CreateContainer from '@/modules/container/presentation/components/templates/CreateContainer';
import SSHConnectionsPage from '@/modules/ssh/presentation/components/templates/SSHConnectionsPage';
import SSHFileExplorerPage from '@/modules/ssh/presentation/components/templates/SSHFileExplorerPage';
import DashboardLayout from '@/modules/dashboard/presentation/components/organisms/DashboardLayout';
import Dashboard from '@/modules/dashboard/presentation/components/templates/Dashboard';
import MessagesPage from '@/modules/chat/presentation/components/templates/MessagesPage';
import ErrorPage from '@/shared/presentation/components/ErrorPage';

export const routesConfig: RouteGroup = {
    public: [
        {
            path: '/error',
            component: ErrorPage
        }
    ],

    protected: [
        // Dashboard routes (with layout)
        {
            path: '/dashboard',
            component: Dashboard,
            index: true
        },
        {
            path: '/dashboard/settings/general',
            component: GeneralSettings
        },
        {
            path: '/dashboard/settings/authentication',
            component: AuthenticationSettings
        },
        {
            path: '/dashboard/settings/theme',
            component: ThemeSettings
        },
        {
            path: '/dashboard/settings/notifications',
            component: NotificationSettings
        },
        {
            path: '/dashboard/my-team',
            component: MyTeamTemplate
        },
        {
            path: '/dashboard/manage-roles',
            component: ManageRolesTemplate
        },
        {
            path: '/dashboard/trajectories/list',
            component: TrajectoriesListing
        },
        {
            path: '/canvas/:trajectoryId',
            component: CanvasPage
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/atoms/:exposureId',
            component: PerAtomViewer
        },
        {
            path: '/dashboard/analysis-configs/list',
            component: AnalysesListing
        },
        {
            path: '/dashboard/simulation-cells/list',
            component: SimulationCellsListing
        },
        {
            path: '/dashboard/plugins/list',
            component: PluginsListing
        },
        {
            path: '/plugins/builder',
            component: PluginBuilderPage
        },
        {
            path: '/dashboard/plugins/:pluginSlug/exposure/:exposureId/listing',
            component: PluginListingPage
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginSlug/exposure/:exposureId/listing',
            component: PluginListingPage
        },
        {
            path: '/dashboard/clusters',
            component: ClustersPage
        },
        {
            path: '/dashboard/containers',
            component: ContainersListing
        },
        {
            path: '/dashboard/containers/new',
            component: CreateContainer
        },
        {
            path: '/dashboard/containers/:id',
            component: ContainerDetailsLayout,
            children: [
                { path: 'overview', component: ContainerOverviewPage, index: true },
                { path: 'processes', component: ContainerProcessesPage },
                { path: 'logs', component: ContainerLogsPage },
                { path: 'storage', component: ContainerStoragePage }
            ]
        },
        {
            path: '/dashboard/ssh-connections',
            component: SSHConnectionsPage
        },
        {
            path: '/dashboard/ssh-connections/:connectionId/file-explorer',
            component: SSHFileExplorerPage
        },
        {
            path: '/dashboard/messages/:chatId?',
            component: MessagesPage
        }
    ],

    guest: [
        {
            path: '/auth/sign-in',
            component: SignInPage
        },
        {
            path: '/auth/oauth/callback',
            component: OAuthCallbackPage
        },
        {
            path: '/team-invitation/:invitationId',
            component: TeamInvitationTemplate
        }
    ],

    // Layout component for dashboard routes
    dashboardLayout: DashboardLayout
};
