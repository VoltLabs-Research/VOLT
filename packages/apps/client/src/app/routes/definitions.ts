import { DashboardNavigationIconKey, DashboardNavigationSection } from '@/app/routes/types';
import type { RouteConfig } from '@/app/routes/types';
import { TeamArea } from '@volt/contracts/modules/team/access';
import { readAccess, writeAccess } from '@/modules/team/utils/team/team-access';

export const publicRoutes: RouteConfig[] = [
    {
        path: '/',
        title: 'VOLT',
        loader: () => import('@/app/routes/HomeRedirect')
    },
    {
        path: '/error',
        title: 'Error',
        loader: () => import('@/shared/ui/components/ErrorPage')
    },
    {
        path: '/connect',
        title: 'Connect',
        loader: () => import('@/modules/auth/components/ConnectEndpoint')
    }
];

export const protectedRoutes: RouteConfig[] = [
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
            label: 'General',
            icon: DashboardNavigationIconKey.SettingsGeneral
        }
    },
    {
        path: '/dashboard/settings/authentication',
        title: 'Authentication Settings',
        loader: () => import('@/modules/auth/components/AuthenticationSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Authentication',
            icon: DashboardNavigationIconKey.SettingsAuthentication,
            multiTenantOnly: true
        }
    },
    {
        path: '/dashboard/settings/integrations',
        title: 'Integrations Settings',
        loader: () => import('@/modules/team/components/IntegrationsSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Integrations',
            icon: DashboardNavigationIconKey.SettingsIntegrations
        }
    },
    {
        path: '/dashboard/settings/sessions',
        title: 'Session Settings',
        loader: () => import('@/modules/session/components/SessionSettings'),
        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Sessions',
            icon: DashboardNavigationIconKey.SettingsSessions,
            multiTenantOnly: true
        }
    },
    {
        path: '/dashboard/my-team',
        title: 'My Team',
        loader: () => import('@/modules/team/components/MyTeam'),
        requiredAccess: [readAccess(TeamArea.Team)],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'My Team',
            icon: DashboardNavigationIconKey.MyTeam,
            disabledReason: 'You do not have permission to view team details.',
            multiTenantOnly: true
        }
    },
    {
        path: '/dashboard/settings/secret-keys',
        title: 'Secret Keys',
        loader: () => import('@/modules/team/components/SecretKeysListing'),
        requiredAccess: [readAccess(TeamArea.TeamSecretKey)],

        navigation: {
            section: DashboardNavigationSection.Settings,
            label: 'Secret Keys',
            icon: DashboardNavigationIconKey.SecretKeys
        }
    },
    {
        path: '/dashboard/settings/secret-keys/metrics',
        title: 'Secret Key Metrics',
        loader: () => import('@/modules/team/components/SecretKeyMetrics'),
        requiredAccess: [readAccess(TeamArea.TeamSecretKey)]
    },
    {
        path: '/dashboard/settings/secret-keys/:secretKeyId',
        title: 'Secret Key',
        loader: () => import('@/modules/team/components/SecretKeyUsage'),
        requiredAccess: [readAccess(TeamArea.TeamSecretKey)]
    },
    {
        path: '/dashboard/trajectories/list',
        title: 'Trajectories',
        loader: () => import('@/modules/trajectory/components/TrajectoriesListing'),
        requiredAccess: [readAccess(TeamArea.Trajectory)]
    },
    {
        path: '/dashboard/trajectories/artifacts',
        title: 'Trajectory Artifacts',
        loader: () => import('@/modules/trajectory/components/TrajectoryArtifactsListing'),
        requiredAccess: [readAccess(TeamArea.Trajectory)]
    },
    {
        path: '/dashboard/whiteboard/:whiteboardId',
        title: 'Whiteboard',
        loader: () => import('@/modules/whiteboards/components/WhiteboardEditorPage'),
        requiredAccess: [readAccess(TeamArea.Whiteboard)]
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/atoms',
        title: 'Trajectory Atoms',
        loader: () => import('@/modules/trajectory/components/PerAtomViewer'),
        requiredAccess: [readAccess(TeamArea.Trajectory)]
    },
    {
        path: '/dashboard/analysis',
        title: 'Analysis',
        loader: () => import('@/modules/analysis/components/AnalysisPage'),
        requiredAccess: [readAccess(TeamArea.Analysis)]
    },
    {
        path: '/dashboard/analysis/:analysisId',
        title: 'Analysis Report',
        loader: () => import('@/modules/analysis/components/AnalysisReportPage'),
        requiredAccess: [readAccess(TeamArea.Analysis), readAccess(TeamArea.Plugin)]
    },
    {
        path: '/dashboard/simulation-cells/list',
        title: 'Simulation Cells',
        loader: () => import('@/modules/simulation-cell/components/SimulationCellsListing'),
        requiredAccess: [readAccess(TeamArea.SimulationCell)]
    },
    {
        path: '/dashboard/plugins/list',
        title: 'Plugins',
        loader: () => import('@/modules/plugin/components/listing/PluginsListing'),
        requiredAccess: [readAccess(TeamArea.Plugin)]
    },
    {
        path: '/dashboard/plugins/marketplace',
        title: 'Marketplace',
        loader: () => import('@/modules/plugin/components/marketplace/MarketplacePage'),
        requiredAccess: [readAccess(TeamArea.Plugin)]
    },
    {
        path: '/plugins/builder',
        title: 'Plugin Builder',
        loader: () => import('@/modules/plugin/components/plugin/PluginBuilderPage'),
        requiredAccess: [writeAccess(TeamArea.Plugin)]
    },
    {
        path: '/dashboard/plugins/:pluginId/exposure/:exposureId/listing',
        title: 'Plugin Listing',
        loader: () => import('@/modules/plugin/components/listing/PluginListingPage'),
        requiredAccess: [readAccess(TeamArea.Plugin)]
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginId/exposure/:exposureId/listing',
        title: 'Plugin Listing',
        loader: () => import('@/modules/plugin/components/listing/PluginListingPage'),
        requiredAccess: [readAccess(TeamArea.Plugin), readAccess(TeamArea.Trajectory)]
    },
    {
        path: '/dashboard/trajectory/:trajectoryId/analysis/:analysisId/sub-listings',
        title: 'Sub-Listings',
        loader: () => import('@/modules/plugin/components/listing/SubListingsPage'),
        requiredAccess: [readAccess(TeamArea.Plugin), readAccess(TeamArea.Trajectory)]
    },
    {
        path: '/onboarding',
        title: 'Onboarding',
        loader: () => import('@/modules/onboarding/components/templates/PostAuthOnboarding')
    },
    {
        path: '/onboarding/cluster/setup',
        title: 'Cluster Setup',
        requiresMachine: true,
        loader: () => import('@/modules/cluster/components/ClusterOnboardingPage')
    },
    {
        path: '/dashboard/clusters',
        title: 'Clusters',
        requiresMachine: true,
        loader: () => import('@/modules/cluster/components/ClustersListing')
    },
    {
        path: '/dashboard/clusters/:clusterId',
        title: 'Cluster Monitoring',
        requiresMachine: true,
        loader: () => import('@/modules/cluster/components/ClusterMonitoringPage')
    },
    {
        path: '/dashboard/ai/:conversationId?',
        title: 'AI',
        loader: () => import('@/modules/ai/components/AIPage'),
        requiredAccess: [readAccess(TeamArea.AIConversation)],
        navigation: {
            section: DashboardNavigationSection.Secondary,
            label: 'VOLT AI',
            icon: DashboardNavigationIconKey.AI,
            disabledReason: 'You do not have permission to access VOLT AI.'
        }
    },
    {
        path: '/dashboard/notebooks',
        title: 'Notebooks',
        loader: () => import('@/modules/scripting/components/NotebooksListing'),
        requiredAccess: [readAccess(TeamArea.Plugin)],
        navigation: {
            section: DashboardNavigationSection.Main,
            label: 'Notebooks',
            icon: DashboardNavigationIconKey.Notebooks,
            disabledReason: 'You do not have permission to view notebooks.'
        }
    },
    {
        path: '/dashboard/notebooks/:notebookId',
        title: 'Notebook',
        loader: () => import('@/modules/scripting/components/NotebookEditorPage'),
        requiredAccess: [readAccess(TeamArea.Plugin)]
    },
    {
        path: '/dashboard/whiteboards',
        title: 'Whiteboards',
        loader: () => import('@/modules/whiteboards/components/WhiteboardsListing'),
        requiredAccess: [readAccess(TeamArea.Whiteboard)],
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
