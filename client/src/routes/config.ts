/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
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

import type { RouteGroup } from './types';
import Canvas from '@/pages/protected/Canvas';
import Dashboard from '@/pages/protected/Dashboard';
import TrajectoryFileExplorer from '@/components/organisms/trajectory/TrajectoryFileExplorer';
import HeadlessRasterizerView from '@/pages/protected/HeadlessRasterizerView';
import Messages from '@/pages/protected/Messages';
import PluginListing from '@/pages/protected/PluginListing';
import Plugins from '@/pages/protected/Plugins';
import AnalysisConfigsListing from '@/pages/protected/AnalysisConfigsListing';
import TrajectoriesListing from '@/pages/protected/TrajectoriesListing';
import {
    GeneralPage,
    AuthenticationPage,
    ThemePage,
    NotificationsPage,
    SessionsPage,
    IntegrationsPage,
    DataExportPage,
    AdvancedPage
} from '@/pages/protected/settings';
import Clusters from '@/pages/protected/Clusters';
import SignIn from '@/pages/guest/SignIn';
import TeamInvitationPage from '@/pages/guest/TeamInvitationPage';
import OAuthCallback from '@/pages/guest/OAuthCallback';
import Containers from '@/pages/protected/Containers';
import ContainerDetails from '@/pages/protected/ContainerDetails';
import CreateContainer from '@/pages/protected/CreateContainer';
import PluginBuilder from '@/pages/protected/PluginBuilder';
import PerAtomViewer from '@/pages/protected/PerAtomViewer';

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
            component: TrajectoryFileExplorer,
            requiresLayout: true
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
