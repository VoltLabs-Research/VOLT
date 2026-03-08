import { RouteGroup } from './types';
import SignInPage from '@/modules/auth/components/templates/SignIn';
import OAuthCallbackPage from '@/modules/auth/components/templates/OAuthCallback';
import GeneralSettings from '@/modules/auth/components/templates/GeneralSettings';
import AuthenticationSettings from '@/modules/auth/components/templates/AuthenticationSettings';
import ThemeSettings from '@/modules/auth/components/templates/ThemeSettings';
import MyTeamTemplate from '@/modules/team/components/templates/MyTeam';
import ManageRolesTemplate from '@/modules/team/components/templates/ManageRoles';
import TeamInvitationTemplate from '@/modules/team/components/templates/TeamInvitation';
import TrajectoriesListing from '@/modules/trajectory/components/templates/TrajectoriesListing';
import PerAtomViewer from '@/modules/trajectory/components/templates/PerAtomViewer';
import CanvasPage from '@/modules/canvas/components/templates/CanvasPage';
import AnalysesListing from '@/modules/analysis/components/templates/AnalysesListing';
import SimulationCellsListing from '@/modules/simulation-cell/components/templates/SimulationCellsListing';
import PluginsListing from '@/modules/plugin/components/listing/templates/PluginsListing';
import PluginBuilderPage from '@/modules/plugin/components/plugin/templates/PluginBuilderPage';
import PluginListingPage from '@/modules/plugin/components/listing/templates/PluginListingPage';
import ClustersPage from '@/modules/cluster/components/templates/ClustersPage';
import ContainersListing from '@/modules/container/components/templates/ContainersListing';
import ContainerDetailsLayout from '@/modules/container/components/templates/ContainerDetailsLayout';
import ContainerOverviewPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-overview-route';
import ContainerProcessesPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-processes-route';
import ContainerTerminalPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-terminal-route';
import ContainerStoragePage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-storage-route';
import CreateContainer from '@/modules/container/components/templates/CreateContainer';
import SSHConnectionsPage from '@/modules/ssh/components/templates/SSHConnectionsPage';
import SSHFileExplorerPage from '@/modules/ssh/components/templates/SSHFileExplorerPage';
import DashboardLayout from '@/modules/dashboard/components/organisms/DashboardLayout';
import Dashboard from '@/modules/dashboard/components/templates/Dashboard';
import MessagesPage from '@/modules/chat/components/templates/MessagesPage';
import SecretKeysListing from '@/modules/team/components/templates/SecretKeysListing';
import SecretKeyMetrics from '@/modules/team/components/templates/SecretKeyMetrics';
import SecretKeyUsage from '@/modules/team/components/templates/SecretKeyUsage';
import ErrorPage from '@/shared/presentation/components/ErrorPage';
import NotebooksListing from '@/modules/scripting/components/templates/NotebooksListing';
import IntegrationsSettings from '@/modules/team/components/templates/IntegrationsSettings';
import SessionSettings from '@/modules/session/components/templates/SessionSettings';
import AIPage from '@/modules/ai/components/templates/AIPage';
import StartPage from '@/modules/start/components/templates/StartPage';

export const routesConfig: RouteGroup = {
    public: [
        {
            path: '/error',
            component: ErrorPage
        }
    ],

    protected: [
        {
            path: '/start',
            component: StartPage
        },
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
            path: '/dashboard/settings/integrations',
            component: IntegrationsSettings
        },
        {
            path: '/dashboard/settings/sessions',
            component: SessionSettings
        },
        {
            path: '/dashboard/my-team',
            component: MyTeamTemplate,
            requiredPermissions: ['team:read']
        },
        {
            path: '/dashboard/manage-roles',
            component: ManageRolesTemplate,
            requiredPermissions: ['team-role:read']
        },
        {
            path: '/dashboard/secret-keys',
            component: SecretKeysListing,
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/secret-keys/metrics',
            component: SecretKeyMetrics,
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/secret-keys/:secretKeyId/usage',
            component: SecretKeyUsage,
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/trajectories/list',
            component: TrajectoriesListing,
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/canvas/:trajectoryId',
            component: CanvasPage,
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/atoms/:exposureId?',
            component: PerAtomViewer,
            requiredPermissions: ['trajectory:read', 'analysis:read'],
            permissionMode: 'all'
        },
        {
            path: '/dashboard/analysis-configs/list',
            component: AnalysesListing,
            requiredPermissions: ['analysis:read']
        },
        {
            path: '/dashboard/simulation-cells/list',
            component: SimulationCellsListing,
            requiredPermissions: ['simulation-cell:read']
        },
        {
            path: '/dashboard/plugins/list',
            component: PluginsListing,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/plugins/builder',
            component: PluginBuilderPage,
            requiredPermissions: ['plugin:create']
        },
        {
            path: '/dashboard/plugins/:pluginId/exposure/:exposureId/listing',
            component: PluginListingPage,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginId/exposure/:exposureId/listing',
            component: PluginListingPage,
            requiredPermissions: ['plugin:read', 'trajectory:read'],
            permissionMode: 'all'
        },
        {
            path: '/dashboard/clusters',
            component: ClustersPage
        },
        {
            path: '/dashboard/containers',
            component: ContainersListing,
            requiredPermissions: ['container:read']
        },
        {
            path: '/dashboard/containers/new',
            component: CreateContainer,
            requiredPermissions: ['container:create']
        },
        {
            path: '/dashboard/containers/:id',
            component: ContainerDetailsLayout,
            requiredPermissions: ['container:read'],
            children: [
                { path: 'overview', component: ContainerOverviewPage, index: true },
                { path: 'processes', component: ContainerProcessesPage },
                { path: 'terminal', component: ContainerTerminalPage },
                { path: 'logs', component: ContainerTerminalPage },
                { path: 'storage', component: ContainerStoragePage }
            ]
        },
        {
            path: '/dashboard/ssh-connections',
            component: SSHConnectionsPage,
            requiredPermissions: ['ssh-connection:read']
        },
        {
            path: '/dashboard/ssh-connections/:connectionId/file-explorer',
            component: SSHFileExplorerPage,
            requiredPermissions: ['ssh-connection:read']
        },
        {
            path: '/dashboard/messages/:chatId?',
            component: MessagesPage
        },
        {
            path: '/dashboard/ai/:conversationId?',
            component: AIPage,
            requiredPermissions: ['ai-conversation:read']
        },
        {
            path: '/dashboard/notebooks',
            component: NotebooksListing,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/team-invitation/:invitationId',
            component: TeamInvitationTemplate
        },

    ],

    guest: [
        {
            path: '/auth/sign-in',
            component: SignInPage
        },
        {
            path: '/auth/oauth/callback',
            component: OAuthCallbackPage
        }
    ],

    dashboardLayout: DashboardLayout
};
