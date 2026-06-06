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
        path: '/dashboard',
        title: 'Dashboard',
        loader: () => import('@/modules/dashboard/components/Dashboard'),
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
        loader: () => import('@/modules/auth/components/GeneralSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'General'
        }
    },
    {
        path: '/dashboard/settings/authentication',
        title: 'Authentication Settings',
        loader: () => import('@/modules/auth/components/AuthenticationSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Authentication'
        }
    },
    {
        path: '/dashboard/settings/theme',
        title: 'Theme Settings',
        loader: () => import('@/modules/auth/components/ThemeSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Theme'
        }
    },
    {
        path: '/dashboard/settings/integrations',
        title: 'Integrations Settings',
        loader: () => import('@/modules/team/components/IntegrationsSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Integrations'
        }
    },
    {
        path: '/dashboard/settings/sessions',
        title: 'Session Settings',
        loader: () => import('@/modules/session/components/SessionSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Sessions'
        }
    },
    {
        path: '/dashboard/my-team',
        title: 'My Team',
        loader: () => import('@/modules/team/components/MyTeam'),
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
        loader: () => import('@/modules/team/components/ManageRoles'),
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
        loader: () => import('@/modules/team/components/SecretKeysListing'),
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
        loader: () => import('@/modules/team/components/SecretKeyMetrics'),
        requiredPermissions: ['team-secret-key:read']
    },
    {
        path: '/dashboard/secret-keys/:secretKeyId',
        title: 'Secret Key',
        loader: () => import('@/modules/team/components/SecretKeyUsage'),
        requiredPermissions: ['team-secret-key:read']
    },
    {
        path: '/dashboard/secret-keys/:secretKeyId/usage',
        title: 'Secret Key Usage',
        loader: () => import('@/modules/team/components/SecretKeyUsage'),
        requiredPermissions: ['team-secret-key:read']
    },
    {
        path: '/dashboard/trajectories/list',
        title: 'Trajectories',
        loader: () => import('@/modules/trajectory/components/TrajectoriesListing'),
        requiredPermissions: ['trajectory:read']
    },
    {
        path: '/dashboard/trajectories/artifacts',
        title: 'Trajectory Artifacts',
        loader: () => import('@/modules/trajectory/components/TrajectoryArtifactsListing'),
        requiredPermissions: ['trajectory:read']
    },
    {
        path: '/dashboard/whiteboard/:whiteboardId',
        title: 'Whiteboard',
        loader: () => import('@/modules/whiteboards/components/WhiteboardEditorPage'),
        requiredPermissions: ['whiteboard:read']
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/atoms',
        title: 'Trajectory Atoms',
        loader: () => import('@/modules/trajectory/components/PerAtomViewer'),
        requiredPermissions: ['trajectory:read']
    },
    {
        path: '/dashboard/analysis-configs/list',
        title: 'Analysis Configurations',
        loader: () => import('@/modules/analysis/components/AnalysesListing'),
        requiredPermissions: ['analysis:read']
    },
    {
        path: '/dashboard/simulation-cells/list',
        title: 'Simulation Cells',
        loader: () => import('@/modules/simulation-cell/components/SimulationCellsListing'),
        requiredPermissions: ['simulation-cell:read']
    },
    {
        path: '/dashboard/plugins/list',
        title: 'Plugins',
        loader: () => import('@/modules/plugin/components/listing/PluginsListing'),
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
        loader: () => import('@/modules/plugin/components/plugin/PluginBuilderPage'),
        requiredPermissions: ['plugin:create']
    },
    {
        path: '/dashboard/plugins/:pluginId/exposure/:exposureId/listing',
        title: 'Plugin Listing',
        loader: () => import('@/modules/plugin/components/listing/PluginListingPage'),
        requiredPermissions: ['plugin:read']
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginId/exposure/:exposureId/listing',
        title: 'Plugin Listing',
        loader: () => import('@/modules/plugin/components/listing/PluginListingPage'),
        requiredPermissions: ['plugin:read', 'trajectory:read'],
        permissionMode: RoutePermissionMode.All
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/sub-listings',
        title: 'Sub-Listings',
        loader: () => import('@/modules/plugin/components/listing/SubListingsPage'),
        requiredPermissions: ['plugin:read', 'trajectory:read'],
        permissionMode: RoutePermissionMode.All
    },
    {
        path: '/onboarding',
        title: 'Onboarding',
        loader: () => import('@/modules/onboarding/components/templates/PostAuthOnboarding')
    },
    {
        path: '/onboarding/cluster/choice',
        title: 'Choose Cluster',
        loader: () => import('@/modules/onboarding/components/templates/OnboardingChoicePage')
    },
    {
        path: '/onboarding/cluster/setup',
        title: 'Cluster Setup',
        loader: () => import('@/modules/cluster/components/ClusterOnboardingPage')
    },
    {
        path: '/onboarding/cluster/provisioning',
        title: 'Provisioning Demo',
        loader: () => import('@/modules/onboarding/components/templates/DemoProvisioningPage')
    },
    {
        path: '/dashboard/clusters',
        title: 'Clusters',
        loader: () => import('@/modules/cluster/components/ClustersListing')
    },
    {
        path: '/dashboard/clusters/:clusterId',
        title: 'Cluster Monitoring',
        loader: () => import('@/modules/cluster/components/ClusterMonitoringPage')
    },
    {
        path: '/dashboard/containers',
        title: 'Containers',
        loader: () => import('@/modules/container/components/ContainersListing'),
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
        loader: () => import('@/modules/container/components/CreateContainer'),
        requiredPermissions: ['container:create']
    },
    {
        path: '/dashboard/containers/:id',
        title: 'Container Details',
        loader: () => import('@/modules/container/components/ContainerDetailsLayout'),
        requiredPermissions: ['container:read'],
        children: [
            {
                path: '',
                title: 'Container Overview',
                loader: () => import('@/modules/container/components/ContainerDetailsRoutes/container-overview-route'),
                index: true
            },
            {
                path: 'processes',
                title: 'Container Processes',
                loader: () => import('@/modules/container/components/ContainerDetailsRoutes/container-processes-route')
            },
            {
                path: 'terminal',
                title: 'Container Terminal',
                loader: () => import('@/modules/container/components/ContainerDetailsRoutes/container-terminal-route')
            },
            {
                path: 'storage',
                title: 'Container Storage',
                loader: () => import('@/modules/container/components/ContainerDetailsRoutes/container-storage-route')
            }
        ]
    },
    {
        path: '/dashboard/messages/:chatId?',
        title: 'Messages',
        loader: () => import('@/modules/chat/components/MessagesPage'),
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'Messages',
            icon: DashboardNavigationIconKey.Messages
        }
    },
    {
        path: '/dashboard/ai/:conversationId?',
        title: 'AI',
        loader: () => import('@/modules/ai/components/AIPage'),
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
        loader: () => import('@/modules/latex/components/LatexDocumentsListing'),
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
        loader: () => import('@/modules/latex/components/LatexDocumentWorkspace'),
        requiredPermissions: ['latex:read']
    },
    {
        path: '/dashboard/notebooks',
        title: 'Notebooks',
        loader: () => import('@/modules/scripting/components/NotebooksListing'),
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
        loader: () => import('@/modules/whiteboards/components/WhiteboardsListing'),
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
        loader: () => import('@/modules/team/components/TeamInvitationByCode')
    },
    {
        path: '/team-invitation/:invitationId',
        title: 'Team Invitation',
        loader: () => import('@/modules/team/components/TeamInvitation')
    }
];

export const guestRoutes: RouteConfig[] = [
    {
        path: '/auth/sign-in',
        title: 'Sign In',
        loader: () => import('@/modules/auth/components/SignIn')
    },
    {
        path: '/auth/oauth/callback',
        title: 'Signing In',
        loader: () => import('@/modules/auth/components/OAuthCallback')
    }
];

export const optionalAuthRoutes: RouteConfig[] = [
    {
        path: '/discover/teams/:teamId',
        title: 'Public Trajectories',
        loader: () => import('@/modules/trajectory/components/DiscoverTeamTrajectoriesPage')
    },
    {
        path: '/canvas/glb',
        loader: () => import('@/modules/canvas/components/CanvasPage')
    },
    {
        path: '/canvas/:trajectoryId',
        loader: () => import('@/modules/canvas/components/CanvasPage')
    },
    {
        path: '/canvas/:trajectoryId/workspace/:ownerId',
        loader: () => import('@/modules/canvas/components/CanvasPage')
    }
];
