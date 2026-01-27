/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import type { RouteGroup } from '@/app/routes/types';
import Canvas from '@/features/canvas/pages/protected/Canvas';
import Dashboard from '@/pages/protected/Dashboard';
import FileExplorer from '@/features/trajectory/pages/protected/FileExplorer';
import SSHConnectionsListing from '@/features/ssh/pages/protected/SSHConnectionsListing';
import SSHFileExplorer from '@/features/ssh/pages/protected/SSHFileExplorer';
import MyTeam from '@/features/team/pages/protected/MyTeam';
import HeadlessRasterizerView from '@/features/raster/pages/protected/HeadlessRasterizerView';
import Messages from '@/features/chat/pages/protected/Messages';
import PluginListing from '@/features/plugins/pages/protected/PluginListing';
import Plugins from '@/features/plugins/pages/protected/Plugins';
import AnalysisConfigsListing from '@/features/analysis/pages/protected/AnalysisConfigsListing';
import TrajectoriesListing from '@/features/trajectory/pages/protected/TrajectoriesListing';
import SimulationCellsListing from '@/features/simulation-cell/pages/SimulationCellsListing';
import {
    GeneralPage,
    AuthenticationPage,
    ThemePage,
    NotificationsPage,
    SessionsPage,
    IntegrationsPage,
    DataExportPage,
    AdvancedPage
} from '@/features/settings/pages/protected/';
import Clusters from '@/features/clusters/pages/protected/Clusters';
import SignIn from '@/features/auth/pages/guest/SignIn';
import TeamInvitationPage from '@/features/team-invitation/pages/guest/TeamInvitationPage';
import OAuthCallback from '@/features/auth/pages/guest/OAuthCallback';
import Containers from '@/features/container/pages/protected/Containers';
import ContainerDetails from '@/features/container/pages/protected/ContainerDetails';
import CreateContainer from '@/features/container/pages/protected/CreateContainer';
import PluginBuilder from '@/features/plugins/pages/protected/PluginBuilder';
import PerAtomViewer from '@/features/trajectory/pages/protected/PerAtomViewer';
import ManageRoles from '@/features/team-role/pages/protected/ManageRoles';

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
            component: Dashboard,
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
            path: '/dashboard/file-explorer',
            component: FileExplorer,
            requiresLayout: true
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
        // Settings routes with nested layout
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
