import { RouteGroup } from './types';
import SignInPage from '@/modules/auth/presentation/components/templates/SignIn';
import OAuthCallbackPage from '@/modules/auth/presentation/components/templates/OAuthCallback';
import GeneralSettings from '@/modules/auth/presentation/components/templates/Settings/GeneralSettings';
import AuthenticationSettings from '@/modules/auth/presentation/components/templates/Settings/AuthenticationSettings';
import ThemeSettings from '@/modules/auth/presentation/components/templates/Settings/ThemeSettings';
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
import SecretKeysListing from '@/modules/team/presentation/components/templates/SecretKeysListing';
import SecretKeyMetrics from '@/modules/team/presentation/components/templates/SecretKeyMetrics';
import SecretKeyUsage from '@/modules/team/presentation/components/templates/SecretKeyUsage';
import ErrorPage from '@/shared/presentation/components/ErrorPage';
import NotebooksListing from '@/modules/scripting/presentation/components/templates/NotebooksListing';
import IntegrationsSettings from '@/modules/auth/presentation/components/templates/Settings/IntegrationsSettings';
import SessionSettings from '@/modules/session/presentation/components/templates/SessionSettings';
import AIPage from '@/modules/ai/presentation/components/templates/AIPage';

export const routesConfig: RouteGroup = {
    public: [
        {
            path: '/error',
            component: ErrorPage
        }
    ],

    protected: [
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
            component: CanvasPage
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
            component: PluginBuilderPage
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
                { path: 'logs', component: ContainerLogsPage },
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
            component: AIPage
        },
        {
            path: '/dashboard/notebooks',
            component: NotebooksListing
        },
        {
            path: '/team-invitation/:invitationId',
            component: TeamInvitationTemplate
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
        }
    ],

    dashboardLayout: DashboardLayout
};
