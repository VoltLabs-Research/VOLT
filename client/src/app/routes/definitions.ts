import RootDashboardRedirect from '@/app/routes/RootDashboardRedirect';
import { DashboardNavigationIconKey, DashboardNavigationSection, RoutePermissionMode } from '@/app/routes/types';
import type { RouteConfig } from '@/app/routes/types';

export const publicRoutes: RouteConfig[] = [
    {
        path: '/error',
        title: 'Error',
        loader: () => import('@/shared/presentation/components/ErrorPage')
    }
];

export const protectedRoutes: RouteConfig[] = [
    {
        path: '/',
        title: 'Dashboard',
        component: RootDashboardRedirect
    },
    {
        path: '/start',
        title: 'Start',
        loader: () => import('@/modules/start/components/templates/StartPage')
    },
    {
        path: '/dashboard',
        title: 'Dashboard',
        loader: () => import('@/modules/dashboard/components/templates/Dashboard'),
        index: true,
        navigation: {
            section: DashboardNavigationSection.Main,
            label: 'Dashboard',
            icon: DashboardNavigationIconKey.Dashboard
        }
    },
    {
        path: '/dashboard/settings/general',
        title: 'General Settings',
        loader: () => import('@/modules/auth/components/templates/GeneralSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'General'
        }
    },
    {
        path: '/dashboard/settings/authentication',
        title: 'Authentication Settings',
        loader: () => import('@/modules/auth/components/templates/AuthenticationSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Authentication'
        }
    },
    {
        path: '/dashboard/settings/theme',
        title: 'Theme Settings',
        loader: () => import('@/modules/auth/components/templates/ThemeSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Theme'
        }
    },
    {
        path: '/dashboard/settings/integrations',
        title: 'Integrations Settings',
        loader: () => import('@/modules/team/components/templates/IntegrationsSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Integrations'
        }
    },
    {
        path: '/dashboard/settings/sessions',
        title: 'Session Settings',
        loader: () => import('@/modules/session/components/templates/SessionSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Sessions'
        }
    },
    {
        path: '/dashboard/my-team',
        title: 'My Team',
        loader: () => import('@/modules/team/components/templates/MyTeam'),
        requiredPermissions: ['team:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'My Team',
            icon: DashboardNavigationIconKey.MyTeam,
            disabledReason: 'You do not have permission to view team details.'
        }
    },
    {
        path: '/dashboard/manage-roles',
        title: 'Manage Roles',
        loader: () => import('@/modules/team/components/templates/ManageRoles'),
        requiredPermissions: ['team-role:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Manage Roles',
            icon: DashboardNavigationIconKey.ManageRoles,
            disabledReason: 'You do not have permission to view role management.'
        }
    },
    {
        path: '/dashboard/secret-keys',
        title: 'Secret Keys',
        loader: () => import('@/modules/team/components/templates/SecretKeysListing'),
        requiredPermissions: ['team-secret-key:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Secret Keys',
            icon: DashboardNavigationIconKey.SecretKeys,
            disabledReason: 'You do not have permission to view secret keys.'
        }
    },
    {
        path: '/dashboard/secret-keys/metrics',
        title: 'Secret Key Metrics',
        loader: () => import('@/modules/team/components/templates/SecretKeyMetrics'),
        requiredPermissions: ['team-secret-key:read']
    },
    {
        path: '/dashboard/secret-keys/:secretKeyId',
        title: 'Secret Key',
        loader: () => import('@/modules/team/components/templates/SecretKeyUsage'),
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
        loader: () => import('@/modules/trajectory/components/templates/TrajectoriesListing'),
        requiredPermissions: ['trajectory:read']
    },
    {
        path: '/dashboard/trajectories/artifacts',
        title: 'Trajectory Artifacts',
        loader: () => import('@/modules/trajectory/components/templates/TrajectoryArtifactsListing'),
        requiredPermissions: ['trajectory:read']
    },
    {
        path: '/canvas/glb',
        title: 'GLB Viewer',
        loader: () => import('@/modules/canvas/components/templates/CanvasPage')
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
        loader: () => import('@/modules/analysis/components/templates/AnalysesListing'),
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
        loader: () => import('@/modules/plugin/components/listing/templates/PluginsListing'),
        requiredPermissions: ['plugin:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Plugins',
            icon: DashboardNavigationIconKey.Plugins,
            disabledReason: 'You do not have permission to view plugins.'
        }
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
        loader: () => import('@/modules/onboarding/components/templates/PostAuthOnboarding')
    },
    {
        path: '/onboarding/cluster/setup',
        title: 'Cluster Setup',
        loader: () => import('@/modules/cluster/components/templates/ClusterOnboardingPage')
    },
    {
        path: '/dashboard/clusters',
        title: 'Clusters',
        loader: () => import('@/modules/cluster/components/templates/ClustersListing')
    },
    {
        path: '/dashboard/clusters/:clusterId',
        title: 'Cluster Monitoring',
        loader: () => import('@/modules/cluster/components/templates/ClusterMonitoringPage')
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
        loader: () => import('@/modules/container/components/templates/ContainersListing'),
        requiredPermissions: ['container:read'],
        navigation: {
            section: DashboardNavigationSection.Main,
            label: 'Containers',
            icon: DashboardNavigationIconKey.Containers,
            disabledReason: 'You do not have permission to view containers.'
        }
    },
    {
        path: '/dashboard/containers/new',
        title: 'Create Container',
        loader: () => import('@/modules/container/components/templates/CreateContainer'),
        requiredPermissions: ['container:create']
    },
    {
        path: '/dashboard/containers/:id',
        title: 'Container Details',
        loader: () => import('@/modules/container/components/templates/ContainerDetailsLayout'),
        requiredPermissions: ['container:read'],
        children: [
            {
                path: 'overview',
                title: 'Container Overview',
                loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-overview-route'),
                index: true
            },
            {
                path: 'processes',
                title: 'Container Processes',
                loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-processes-route')
            },
            {
                path: 'terminal',
                title: 'Container Terminal',
                loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-terminal-route')
            },
            {
                path: 'storage',
                title: 'Container Storage',
                loader: () => import('@/modules/container/components/templates/ContainerDetailsRoutes/container-storage-route')
            }
        ]
    },
    {
        path: '/dashboard/ssh-connections',
        title: 'SSH Connections',
        loader: () => import('@/modules/ssh/components/templates/SSHConnectionsPage'),
        requiredPermissions: ['ssh-connection:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Import',
            icon: DashboardNavigationIconKey.Import,
            disabledReason: 'You do not have permission to view SSH connections.'
        }
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
        loader: () => import('@/modules/chat/components/templates/MessagesPage'),
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Messages',
            icon: DashboardNavigationIconKey.Messages
        }
    },
    {
        path: '/dashboard/ai/:conversationId?',
        title: 'AI',
        loader: () => import('@/modules/ai/components/templates/AIPage'),
        requiredPermissions: ['ai-conversation:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Volt AI',
            icon: DashboardNavigationIconKey.AI,
            disabledReason: 'You do not have permission to access Volt AI.'
        }
    },
    {
        path: '/dashboard/latex',
        title: 'LaTeX Documents',
        loader: () => import('@/modules/latex/components/templates/LatexDocumentsListing'),
        requiredPermissions: ['latex:read'],
        navigation: {
            section: DashboardNavigationSection.Main,
            label: 'LaTeX',
            icon: DashboardNavigationIconKey.Latex,
            disabledReason: 'You do not have permission to view LaTeX documents.'
        }
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
        loader: () => import('@/modules/scripting/components/templates/NotebooksListing'),
        requiredPermissions: ['plugin:read'],
        navigation: {
            section: DashboardNavigationSection.Main,
            label: 'Notebooks',
            icon: DashboardNavigationIconKey.Notebooks,
            disabledReason: 'You do not have permission to view notebooks.'
        }
    },
    {
        path: '/dashboard/whiteboards',
        title: 'Whiteboards',
        loader: () => import('@/modules/whiteboards/components/templates/WhiteboardsListing'),
        requiredPermissions: ['whiteboard:read'],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Whiteboards',
            icon: DashboardNavigationIconKey.Whiteboards,
            disabledReason: 'You do not have permission to view whiteboards.'
        }
    },
    {
        path: '/team-invitation/code/:code',
        title: 'Team Invitation',
        loader: () => import('@/modules/team/components/templates/TeamInvitationByCode')
    },
    {
        path: '/team-invitation/:invitationId',
        title: 'Team Invitation',
        loader: () => import('@/modules/team/components/templates/TeamInvitation')
    }
];

export const guestRoutes: RouteConfig[] = [
    {
        path: '/auth/sign-in',
        title: 'Sign In',
        loader: () => import('@/modules/auth/components/templates/SignIn')
    },
    {
        path: '/auth/oauth/callback',
        title: 'Signing In',
        loader: () => import('@/modules/auth/components/templates/OAuthCallback')
    }
];
