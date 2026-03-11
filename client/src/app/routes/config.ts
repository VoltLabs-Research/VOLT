import { RouteGroup } from './types';
import AIPage from '@/modules/ai/components/templates/AIPage';
import AnalysesListing from '@/modules/analysis/components/templates/AnalysesListing';
import AuthenticationSettings from '@/modules/auth/components/templates/AuthenticationSettings';
import GeneralSettings from '@/modules/auth/components/templates/GeneralSettings';
import OAuthCallbackPage from '@/modules/auth/components/templates/OAuthCallback';
import SignInPage from '@/modules/auth/components/templates/SignIn';
import ThemeSettings from '@/modules/auth/components/templates/ThemeSettings';
import CanvasPage from '@/modules/canvas/components/templates/CanvasPage';
import MessagesPage from '@/modules/chat/components/templates/MessagesPage';
import ClusterMonitoringPage from '@/modules/cluster/components/templates/ClusterMonitoringPage';
import ClusterOnboardingPage from '@/modules/cluster/components/templates/ClusterOnboardingPage';
import ClustersListing from '@/modules/cluster/components/templates/ClustersListing';
import CreateContainer from '@/modules/container/components/templates/CreateContainer';
import ContainerDetailsLayout from '@/modules/container/components/templates/ContainerDetailsLayout';
import ContainerOverviewPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-overview-route';
import ContainerProcessesPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-processes-route';
import ContainerRemoteDesktopPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-remote-desktop-route';
import ContainerStoragePage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-storage-route';
import ContainerTerminalPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-terminal-route';
import ContainersListing from '@/modules/container/components/templates/ContainersListing';
import DashboardLayout from '@/modules/dashboard/components/organisms/DashboardLayout';
import Dashboard from '@/modules/dashboard/components/templates/Dashboard';
import LatexDocumentsListing from '@/modules/latex/components/templates/LatexDocumentsListing';
import LatexDocumentWorkspace from '@/modules/latex/components/templates/LatexDocumentWorkspace';
import NotebooksListing from '@/modules/scripting/components/templates/NotebooksListing';
import WhiteboardsListing from '@/modules/whiteboards/components/templates/WhiteboardsListing';
import WhiteboardEditorPage from '@/modules/whiteboards/components/templates/WhiteboardEditorPage';
import SSHConnectionsPage from '@/modules/ssh/components/templates/SSHConnectionsPage';
import SSHFileExplorerPage from '@/modules/ssh/components/templates/SSHFileExplorerPage';
import StartPage from '@/modules/start/components/templates/StartPage';
import PostAuthOnboarding from '@/modules/onboarding/components/templates/PostAuthOnboarding';
import PluginBuilderPage from '@/modules/plugin/components/plugin/templates/PluginBuilderPage';
import PluginListingPage from '@/modules/plugin/components/listing/templates/PluginListingPage';
import PluginsListing from '@/modules/plugin/components/listing/templates/PluginsListing';
import SimulationCellsListing from '@/modules/simulation-cell/components/templates/SimulationCellsListing';
import SessionSettings from '@/modules/session/components/templates/SessionSettings';
import IntegrationsSettings from '@/modules/team/components/templates/IntegrationsSettings';
import ManageRolesTemplate from '@/modules/team/components/templates/ManageRoles';
import MyTeamTemplate from '@/modules/team/components/templates/MyTeam';
import SecretKeyMetrics from '@/modules/team/components/templates/SecretKeyMetrics';
import SecretKeysListing from '@/modules/team/components/templates/SecretKeysListing';
import SecretKeyUsage from '@/modules/team/components/templates/SecretKeyUsage';
import TeamInvitationTemplate from '@/modules/team/components/templates/TeamInvitation';
import PerAtomViewer from '@/modules/trajectory/components/templates/PerAtomViewer';
import TrajectoriesListing from '@/modules/trajectory/components/templates/TrajectoriesListing';
import ErrorPage from '@/shared/presentation/components/ErrorPage';

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
            path: '/dashboard/whiteboard/:whiteboardId',
            component: WhiteboardEditorPage,
            requiredPermissions: ['whiteboard:read']
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
            path: '/onboarding',
            component: PostAuthOnboarding
        },
        {
            path: '/onboarding/cluster/setup',
            component: ClusterOnboardingPage
        },
        {
            path: '/dashboard/clusters',
            component: ClustersListing
        },
        {
            path: '/dashboard/clusters/:clusterId',
            component: ClusterMonitoringPage
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
                { path: 'storage', component: ContainerStoragePage },
                { path: 'remote-desktop', component: ContainerRemoteDesktopPage }
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
            path: '/dashboard/latex',
            component: LatexDocumentsListing,
            requiredPermissions: ['latex:read']
        },
        {
            path: '/dashboard/latex/:documentId',
            component: LatexDocumentWorkspace,
            requiredPermissions: ['latex:read']
        },
        {
            path: '/dashboard/notebooks',
            component: NotebooksListing,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/dashboard/whiteboards',
            component: WhiteboardsListing,
            requiredPermissions: ['whiteboard:read']
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
