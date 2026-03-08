import { routesConfig } from './config';
import ProtectedRoute, { RouteMode } from './ProtectedRoute';
import { canAccessByPermissions } from '@/modules/team/utilities/team/permission-evaluator';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import PageTransition from '@/shared/presentation/components/PageTransition';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { Route } from 'react-router-dom';
import type { ComponentType, ReactNode } from 'react';
import type { RouteConfig } from './types';

interface RoutePermissionGuardProps {
    route: RouteConfig;
    children: ReactNode;
};

const wrapWithPageTransition = (Component: ComponentType) => (
    <PageTransition>
        <Component />
    </PageTransition>
);

const RoutePermissionGuard = ({ route, children }: RoutePermissionGuardProps) => {
    const selectedTeamId = useSelectedTeamId();
    const { scopedPermissions, isScopeReady, isLoading: isPermissionsLoading } = useTeamPermissions();
    const permissions = route.requiredPermissions ?? [];
    const mode = route.permissionMode ?? 'any';

    if (permissions.length === 0) {
        return <>{children}</>;
    }

    if (!selectedTeamId) {
        return <>{children}</>;
    }

    if (!isScopeReady) {
        return <>{children}</>;
    }

    if (isPermissionsLoading && scopedPermissions.length === 0) {
        return <>{children}</>;
    }

    const isAllowed = canAccessByPermissions(scopedPermissions, permissions, mode);

    if (!isAllowed) {
        return <AccessDenied />;
    }

    return <>{children}</>;
};

const renderRouteWithChildren = (route: RouteConfig, withTransition = true) => {
    const renderElement = (Component: ComponentType) =>
        (
            <RoutePermissionGuard route={route}>
                {withTransition ? wrapWithPageTransition(Component) : <Component />}
            </RoutePermissionGuard>
        );

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

const renderProtectedRoute = (route: RouteConfig) => renderRouteWithChildren(route);

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
        <Route element={<ProtectedRoute mode={RouteMode.Protected} />}>
            {nonDashboardRoutes.map(renderProtectedRoute)}
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
        <Route element={<ProtectedRoute mode={RouteMode.Guest} />}>
            {routesConfig.guest.map((route: RouteConfig) => (
                <Route
                    key={route.path}
                    path={route.path}
                    element={wrapWithPageTransition(route.component)} />
            ))}
        </Route>
    );
};
