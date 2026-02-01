import { Route } from 'react-router-dom';
import { routesConfig } from './config';
import ProtectedRoute from '@/modules/auth/presentation/components/atoms/ProtectedRoute';
import type { RouteConfig } from './types';

const renderRouteWithChildren = (route: RouteConfig) => {
    if(route.children && route.children.length > 0){
        return (
            <Route
                key={route.path}
                path={route.path}
                element={<route.component />}
            >
                {route.children.map((child) => (
                    child.index ? (
                        <Route
                            key={child.path}
                            index
                            element={<child.component />}
                        />
                    ) : (
                        <Route
                            key={child.path}
                            path={child.path}
                            element={<child.component />}
                        />
                    )
                ))}
            </Route>
        );
    }

    return (
        <Route
            key={route.path}
            path={route.path}
            index={route.index}
            element={<route.component />}
        />
    );
};

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={<route.component />} />
    ));
};

export const renderProtectedRoutes = () => {
    const DashboardLayout = routesConfig.dashboardLayout;

    // Separate dashboard routes from non-dashboard routes
    const dashboardRoutes = routesConfig.protected.filter((route) => 
        route.path.startsWith('/dashboard')
    );

    return (
        <Route element={<ProtectedRoute mode='protected' />}>
            {DashboardLayout && (
                <Route path='/dashboard' element={<DashboardLayout />}>
                    {dashboardRoutes.map(renderRouteWithChildren)}
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
                    element={<route.component />} />
            ))}
        </Route>
    );
};
