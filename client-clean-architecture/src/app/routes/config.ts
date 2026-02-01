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
import AnalysesListing from '@/modules/analysis/presentation/components/templates/AnalysesListing';
import SimulationCellsListing from '@/modules/simulation-cell/presentation/components/templates/SimulationCellsListing';
import PluginsListing from '@/modules/plugin/presentation/components/templates/PluginsListing';
import PluginBuilderPage from '@/modules/plugin/presentation/components/templates/PluginBuilderPage';
import PluginListingPage from '@/modules/plugin/presentation/components/templates/PluginListingPage';
import DashboardLayout from '@/modules/dashboard/presentation/components/organisms/DashboardLayout';
import Dashboard from '@/modules/dashboard/presentation/components/templates/Dashboard';

export const routesConfig: RouteGroup = {
    public: [],

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
            path: '/dashboard/plugins/builder',
            component: PluginBuilderPage
        },
        {
            path: '/dashboard/plugins/:pluginSlug/listing/:listingSlug',
            component: PluginListingPage
        },
        {
            path: '/dashboard/trajectory/:trajectoryId/plugins/:pluginSlug/listing/:listingSlug',
            component: PluginListingPage
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
