import type { RouteGroup } from './types';
import SignInPage from '@/modules/auth/presentation/components/templates/SignIn';
import OAuthCallbackPage from '@/modules/auth/presentation/components/templates/OAuthCallback';

export const routesConfig: RouteGroup = {
    public: [],

    protected: [],

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
