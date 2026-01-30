import { Route } from 'react-router-dom';
import { routesConfig } from './config';
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
    return routesConfig.protected.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={<route.component />} />
    ));
};

export const renderGuestRoutes = () => {
    return routesConfig.guest.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={<route.component />} />
    ));
};
