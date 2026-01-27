import { Route } from 'react-router-dom';
import ProtectedRoute from '@/modules/auth/presentation/components/atoms/ProtectedRoute';
import DashboardLayout from '@/modules/dashboard/presentation/components/organisms/DashboardLayout';
import SettingsLayout from '@/modules/settings/presentation/components/organisms/SettingsLayout';
import PageTransition from '@/shared/presentation/components/atoms/animations/PageTransition';
import { routesConfig } from './config';
import type { RouteConfig } from './types';

const wrapWithPageWrapper = (Component: React.ComponentType) => (
    <PageTransition>
        <Component />
    </PageTransition>
);

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={wrapWithPageWrapper(route.component)}
        />
    ));
};

export const renderProtectedRoutes = () => {
    const routesWithLayout = routesConfig.protected.filter(r => r.requiresLayout && !r.requiresSettingsLayout);
    const routesWithSettingsLayout = routesConfig.protected.filter(r => r.requiresSettingsLayout);
    const routesWithoutLayout = routesConfig.protected.filter(r => !r.requiresLayout);

    return (
        <Route element={<ProtectedRoute mode='protect' />}>
            {routesWithoutLayout.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={wrapWithPageWrapper(route.component)}
                />
            ))}

            {routesWithLayout.length > 0 && (
                <Route element={<DashboardLayout />}>
                    {routesWithLayout.map((route: RouteConfig) => (
                        <Route
                            key={route.path}
                            path={route.path}
                            element={wrapWithPageWrapper(route.component)}
                        />
                    ))}

                    {routesWithSettingsLayout.length > 0 && (
                        <Route element={<SettingsLayout />}>
                            {routesWithSettingsLayout.map((route: RouteConfig) => (
                                <Route
                                    key={route.path}
                                    path={route.path}
                                    element={wrapWithPageWrapper(route.component)}
                                />
                            ))}
                        </Route>
                    )}
                </Route>
            )}
        </Route>
    );
};

export const renderGuestRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode='guest' />}>
            {routesConfig.guest.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={wrapWithPageWrapper(route.component)}
                />
            ))}
        </Route>
    );
};
