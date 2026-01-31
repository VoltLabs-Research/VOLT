import { RouteGroup } from './types';
import SignInPage from '@/modules/auth/presentation/components/templates/SignIn';
import OAuthCallbackPage from '@/modules/auth/presentation/components/templates/OAuthCallback';
import GeneralSettings from '@/modules/auth/presentation/components/templates/Settings/GeneralSettings';
import AuthenticationSettings from '@/modules/auth/presentation/components/templates/Settings/AuthenticationSettings';
import ThemeSettings from '@/modules/auth/presentation/components/templates/Settings/ThemeSettings';
import NotificationSettings from '@/modules/auth/presentation/components/templates/Settings/NotificationSettings';

export const routesConfig: RouteGroup = {
    public: [],

    protected: [
        {
            path: '/settings/general',
            component: GeneralSettings
        },
        {
            path: '/settings/authentication',
            component: AuthenticationSettings
        },
        {
            path: '/settings/theme',
            component: ThemeSettings
        },
        {
            path: '/settings/notifications',
            component: NotificationSettings
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
    ]
};
