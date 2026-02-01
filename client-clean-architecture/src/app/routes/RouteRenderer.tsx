import { Route } from 'react-router-dom';
import { routesConfig } from './config';
import ProtectedRoute from '@/shared/presentation/components/ProtectedRoute';
import type { RouteConfig } from './types';

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={<route.component />} />
    ));
};

export const renderProtectedRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode='protected' />}>
            {routesConfig.protected.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={<route.component />} />
            ))}
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
                    element={<route.component />} />
            ))}
        </Route>
    );
};
