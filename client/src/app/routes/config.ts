import AnalysesListing from '@/modules/analysis/components/templates/AnalysesListing';
import AuthenticationSettings from '@/modules/auth/components/templates/AuthenticationSettings';
import GeneralSettings from '@/modules/auth/components/templates/GeneralSettings';
import OAuthCallbackPage from '@/modules/auth/components/templates/OAuthCallback';
import SignInPage from '@/modules/auth/components/templates/SignIn';
import ThemeSettings from '@/modules/auth/components/templates/ThemeSettings';
import ClusterOnboardingPage from '@/modules/cluster/components/templates/ClusterOnboardingPage';
import ClustersListing from '@/modules/cluster/components/templates/ClustersListing';
import CreateContainer from '@/modules/container/components/templates/CreateContainer';
import ContainerDetailsLayout from '@/modules/container/components/templates/ContainerDetailsLayout';
import ContainerOverviewPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-overview-route';
import ContainerProcessesPage from '@/modules/container/components/templates/ContainerDetailsRoutes/container-processes-route';
import ContainersListing from '@/modules/container/components/templates/ContainersListing';
import DashboardLayout from '@/modules/dashboard/components/organisms/DashboardLayout';
import Dashboard from '@/modules/dashboard/components/templates/Dashboard';
import LatexDocumentsListing from '@/modules/latex/components/templates/LatexDocumentsListing';
import NotebooksListing from '@/modules/scripting/components/templates/NotebooksListing';
import WhiteboardsListing from '@/modules/whiteboards/components/templates/WhiteboardsListing';
import SSHConnectionsPage from '@/modules/ssh/components/templates/SSHConnectionsPage';
import StartPage from '@/modules/start/components/templates/StartPage';
import PostAuthOnboarding from '@/modules/onboarding/components/templates/PostAuthOnboarding';
import PluginsListing from '@/modules/plugin/components/listing/templates/PluginsListing';
import SessionSettings from '@/modules/session/components/templates/SessionSettings';
import IntegrationsSettings from '@/modules/team/components/templates/IntegrationsSettings';
import ManageRolesTemplate from '@/modules/team/components/templates/ManageRoles';
import MyTeamTemplate from '@/modules/team/components/templates/MyTeam';
import SecretKeyMetrics from '@/modules/team/components/templates/SecretKeyMetrics';
import SecretKeysListing from '@/modules/team/components/templates/SecretKeysListing';
import TeamInvitationTemplate from '@/modules/team/components/templates/TeamInvitation';
import TeamInvitationByCodeTemplate from '@/modules/team/components/templates/TeamInvitationByCode';
import TrajectoryArtifactsListing from '@/modules/trajectory/components/templates/TrajectoryArtifactsListing';
import TrajectoriesListing from '@/modules/trajectory/components/templates/TrajectoriesListing';
import ErrorPage from '@/shared/presentation/components/ErrorPage';
import RootDashboardRedirect from './RootDashboardRedirect';
import { RoutePermissionMode } from './types';
import type { RouteGroup } from './types';

export const routesConfig: RouteGroup = {
    public: [
        {
            path: '/error',
            title: 'Error',
            component: ErrorPage
        }
    ],

    protected: [
        {
            path: '/',
            title: 'Dashboard',
            component: RootDashboardRedirect
        },
        {
            path: '/start',
            title: 'Start',
            component: StartPage
        },
        {
            path: '/dashboard',
            title: 'Dashboard',
            component: Dashboard,
            index: true
        },
        {
            path: '/dashboard/settings/general',
            title: 'General Settings',
            component: GeneralSettings
        },
        {
            path: '/dashboard/settings/authentication',
            title: 'Authentication Settings',
            component: AuthenticationSettings
        },
        {
            path: '/dashboard/settings/theme',
            title: 'Theme Settings',
            component: ThemeSettings
        },
        {
            path: '/dashboard/settings/integrations',
            title: 'Integrations Settings',
            component: IntegrationsSettings
        },
        {
            path: '/dashboard/settings/sessions',
            title: 'Session Settings',
            component: SessionSettings
        },
        {
            path: '/dashboard/my-team',
            title: 'My Team',
            component: MyTeamTemplate,
            requiredPermissions: ['team:read']
        },
        {
            path: '/dashboard/manage-roles',
            title: 'Manage Roles',
            component: ManageRolesTemplate,
            requiredPermissions: ['team-role:read']
        },
        {
            path: '/dashboard/secret-keys',
            title: 'Secret Keys',
            component: SecretKeysListing,
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/secret-keys/metrics',
            title: 'Secret Key Metrics',
            component: SecretKeyMetrics,
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/secret-keys/:secretKeyId/usage',
            title: 'Secret Key Usage',
            loader: () => import('@/modules/team/components/templates/SecretKeyUsage'),
            requiredPermissions: ['team-secret-key:read']
        },
        {
            path: '/dashboard/trajectories/list',
            title: 'Trajectories',
            component: TrajectoriesListing,
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/dashboard/trajectories/artifacts',
            title: 'Trajectory Artifacts',
            component: TrajectoryArtifactsListing,
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/canvas/:trajectoryId',
            title: 'Canvas',
            loader: () => import('@/modules/canvas/components/templates/CanvasPage'),
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/dashboard/whiteboard/:whiteboardId',
            title: 'Whiteboard',
            loader: () => import('@/modules/whiteboards/components/templates/WhiteboardEditorPage'),
            requiredPermissions: ['whiteboard:read']
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/atoms',
            title: 'Trajectory Atoms',
            loader: () => import('@/modules/trajectory/components/templates/PerAtomViewer'),
            requiredPermissions: ['trajectory:read']
        },
        {
            path: '/dashboard/analysis-configs/list',
            title: 'Analysis Configurations',
            component: AnalysesListing,
            requiredPermissions: ['analysis:read']
        },
        {
            path: '/dashboard/simulation-cells/list',
            title: 'Simulation Cells',
            loader: () => import('@/modules/simulation-cell/components/templates/SimulationCellsListing'),
            requiredPermissions: ['simulation-cell:read']
        },
        {
            path: '/dashboard/plugins/list',
            title: 'Plugins',
            component: PluginsListing,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/plugins/builder',
            title: 'Plugin Builder',
            loader: () => import('@/modules/plugin/components/plugin/templates/PluginBuilderPage'),
            requiredPermissions: ['plugin:create']
        },
        {
            path: '/dashboard/plugins/:pluginId/exposure/:exposureId/listing',
            title: 'Plugin Listing',
            loader: () => import('@/modules/plugin/components/listing/templates/PluginListingPage'),
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginId/exposure/:exposureId/listing',
            title: 'Plugin Listing',
            loader: () => import('@/modules/plugin/components/listing/templates/PluginListingPage'),
            requiredPermissions: ['plugin:read', 'trajectory:read'],
            permissionMode: RoutePermissionMode.All
        },
        {
            path: '/onboarding',
            title: 'Onboarding',
            component: PostAuthOnboarding
        },
        {
            path: '/onboarding/cluster/setup',
            title: 'Cluster Setup',
            component: ClusterOnboardingPage
        },
        {
            path: '/dashboard/clusters',
            title: 'Clusters',
            component: ClustersListing
        },
        {
            path: '/dashboard/clusters/:clusterId',
            title: 'Cluster Monitoring',
            loader: () => import('@/modules/cluster/components/templates/ClusterMonitoringPage')
        },
        {
            path: '/dashboard/clusters/:clusterId/terminal',
            title: 'Cluster Terminal',
            loader: () => import('@/modules/cluster/components/templates/ClusterTerminalPage')
        },
        {
            path: '/dashboard/clusters/:clusterId/mongo',
            title: 'Mongo Explorer',
            loader: () => import('@/modules/cluster/components/templates/ClusterRemoteExplorerPage')
        },
        {
            path: '/dashboard/clusters/:clusterId/redis',
            title: 'Redis Explorer',
            loader: () => import('@/modules/cluster/components/templates/ClusterRemoteExplorerPage')
        },
        {
            path: '/dashboard/clusters/:clusterId/minio',
            title: 'MinIO Explorer',
            loader: () => import('@/modules/cluster/components/templates/ClusterRemoteExplorerPage')
        },
        {
            path: '/dashboard/containers',
            title: 'Containers',
            component: ContainersListing,
            requiredPermissions: ['container:read']
        },
        {
            path: '/dashboard/containers/new',
            title: 'Create Container',
            component: CreateContainer,
            requiredPermissions: ['container:create']
        },
        {
            path: '/dashboard/containers/:id',
            title: 'Container Details',
            component: ContainerDetailsLayout,
            requiredPermissions: ['container:read'],
            children: [
                { path: 'overview', title: 'Container Overview', component: ContainerOverviewPage, index: true },
                { path: 'processes', title: 'Container Processes', component: ContainerProcessesPage },
                {
                    path: 'terminal',
                    title: 'Container Terminal',
                    loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-terminal-route')
                },
                {
                    path: 'logs',
                    title: 'Container Logs',
                    loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-logs-route')
                },
                {
                    path: 'storage',
                    title: 'Container Storage',
                    loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-storage-route')
                },
                {
                    path: 'remote-desktop',
                    title: 'Container Remote Desktop',
                    loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-remote-desktop-route')
                }
            ]
        },
        {
            path: '/dashboard/ssh-connections',
            title: 'SSH Connections',
            component: SSHConnectionsPage,
            requiredPermissions: ['ssh-connection:read']
        },
        {
            path: '/dashboard/ssh-connections/:connectionId/file-explorer',
            title: 'SSH File Explorer',
            loader: () => import('@/modules/ssh/components/templates/SSHFileExplorerPage'),
            requiredPermissions: ['ssh-connection:read']
        },
        {
            path: '/dashboard/messages/:chatId?',
            title: 'Messages',
            loader: () => import('@/modules/chat/components/templates/MessagesPage')
        },
        {
            path: '/dashboard/ai/:conversationId?',
            title: 'AI',
            loader: () => import('@/modules/ai/components/templates/AIPage'),
            requiredPermissions: ['ai-conversation:read']
        },
        {
            path: '/dashboard/latex',
            title: 'LaTeX Documents',
            component: LatexDocumentsListing,
            requiredPermissions: ['latex:read']
        },
        {
            path: '/dashboard/latex/:documentId',
            title: 'LaTeX Workspace',
            loader: () => import('@/modules/latex/components/templates/LatexDocumentWorkspace'),
            requiredPermissions: ['latex:read']
        },
        {
            path: '/dashboard/notebooks',
            title: 'Notebooks',
            component: NotebooksListing,
            requiredPermissions: ['plugin:read']
        },
        {
            path: '/dashboard/whiteboards',
            title: 'Whiteboards',
            component: WhiteboardsListing,
            requiredPermissions: ['whiteboard:read']
        },
        {
            path: '/team-invitation/code/:code',
            title: 'Team Invitation',
            component: TeamInvitationByCodeTemplate
        },
        {
            path: '/team-invitation/:invitationId',
            title: 'Team Invitation',
            component: TeamInvitationTemplate
        }
    ],

    guest: [
        {
            path: '/auth/sign-in',
            title: 'Sign In',
            component: SignInPage
        },
        {
            path: '/auth/oauth/callback',
            title: 'Signing In',
            component: OAuthCallbackPage
        }
    ],

    dashboardLayout: DashboardLayout
};
