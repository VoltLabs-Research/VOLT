import type { RouteGroup } from './types';
import SignInPage from '@/modules/auth/presentation/components/templates/SignIn';

export const routesConfig: RouteGroup = {
    public: [],

    protected: [],

    guest: [
        {
            path: '/auth/sign-in',
            component: SignInPage
        }
    ]
};
