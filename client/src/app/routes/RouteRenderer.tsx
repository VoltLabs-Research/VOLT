import { Route } from 'react-router-dom';
import { routesConfig } from './config';
import ProtectedRoute from '@/modules/auth/presentation/components/atoms/ProtectedRoute';
import PageTransition from '@/shared/presentation/components/PageTransition';
import type { RouteConfig } from './types';

const wrapWithPageTransition = (Component: React.ComponentType) => (
    <PageTransition>
        <Component />
    </PageTransition>
);

const renderRouteWithChildren = (route: RouteConfig, withTransition = true) => {
    const renderElement = (Component: React.ComponentType) =>
        withTransition ? wrapWithPageTransition(Component) : <Component />;

    if(route.children && route.children.length > 0){
        return (
            <Route
                key={route.path}
                path={route.path}
                element={renderElement(route.component)}
            >
                {route.children.map((child) => (
                    child.index ? (
                        <Route
                            key={child.path}
                            index
                            element={renderElement(child.component)}
                        />
                    ) : (
                        <Route
                            key={child.path}
                            path={child.path}
                            element={renderElement(child.component)}
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
            element={renderElement(route.component)}
        />
    );
};

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => (
        <Route
            key={route.path}
            path={route.path}
            element={wrapWithPageTransition(route.component)} />
    ));
};

export const renderProtectedRoutes = () => {
    const DashboardLayout = routesConfig.dashboardLayout;

    // Separate dashboard routes from non-dashboard routes
    const dashboardRoutes = routesConfig.protected.filter((route) =>
        route.path.startsWith('/dashboard')
    );
    const nonDashboardRoutes = routesConfig.protected.filter((route) =>
        !route.path.startsWith('/dashboard')
    );

    return (
        <Route element={<ProtectedRoute mode='protected' />}>
            {nonDashboardRoutes.map((route) => renderRouteWithChildren(route))}
            {DashboardLayout && (
                <Route path='/dashboard' element={<DashboardLayout />}>
                    {dashboardRoutes.map((route) => renderRouteWithChildren(route, false))}
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
                    element={wrapWithPageTransition(route.component)} />
            ))}
        </Route>
    );
};
