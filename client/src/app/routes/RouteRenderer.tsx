import { canAccessByPermissions } from '@/modules/team/utilities/team/permission-evaluator';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import { Loader } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { guestRoutes, optionalAuthRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import ProtectedRoute, { RouteMode } from '@/app/routes/ProtectedRoute';
import { RoutePermissionMode } from '@/app/routes/types';
import { Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ComponentType, ElementType, LazyExoticComponent, ReactNode } from 'react';
import type { RouteConfig, RouteLoader } from '@/app/routes/types';

interface RoutePermissionGuardProps {
    route: RouteConfig;
    children: ReactNode;
};

const lazyRouteCache = new Map<RouteLoader, LazyExoticComponent<ComponentType>>();
const DASHBOARD_ROUTE_PREFIX = '/dashboard';
const dashboardProtectedRoutes = protectedRoutes.filter((route) => route.path.startsWith(DASHBOARD_ROUTE_PREFIX));
const nonDashboardProtectedRoutes = protectedRoutes.filter((route) => !route.path.startsWith(DASHBOARD_ROUTE_PREFIX));
const LazyDashboardLayout = lazy(() => import('@/modules/dashboard/components/DashboardLayout'));

const resolveRouteComponent = (route: RouteConfig): ElementType => {
    if (route.component) {
        return route.component;
    }

    if (!route.loader) {
        throw new Error(`Route "${route.path}" is missing a component.`);
    }

    const cachedComponent = lazyRouteCache.get(route.loader);
    if (cachedComponent) {
        return cachedComponent;
    }

    const LazyComponent = lazy(route.loader);
    lazyRouteCache.set(route.loader, LazyComponent);

    return LazyComponent;
};

const RoutePermissionGuard = ({ route, children }: RoutePermissionGuardProps) => {
    const selectedTeamId = useSelectedTeamId();
    const hasHydratedSelection = useTeamStore((state) => state.hasHydratedSelection);
    const { scopedPermissions, isScopeReady, isLoading: isPermissionsLoading } = useTeamPermissions();
    const permissions = route.requiredPermissions ?? [];
    const mode = route.permissionMode ?? RoutePermissionMode.Any;
    const isDashboardRoute = route.path.startsWith(DASHBOARD_ROUTE_PREFIX);

    if (permissions.length === 0) {
        return <>{children}</>;
    }

    if (!hasHydratedSelection) {
        return <Loader scale={0.6} label='Loading teams…' announce fillParent={isDashboardRoute} />;
    }

    if (!selectedTeamId) {
        return (
            <RecoveryState
                title='Select a workspace to continue'
                description='Choose a team or finish onboarding before opening this page.'
                tone={RecoveryStateTone.Info}
            />
        );
    }

    if (isPermissionsLoading) {
        return <Loader scale={0.6} label='Checking access…' announce fillParent={isDashboardRoute} />;
    }

    if (!isScopeReady) {
        return (
            <RecoveryState
                title='Preparing workspace access'
                description='We are still loading the permissions for this team. Please wait a moment.'
                tone={RecoveryStateTone.Info}
            />
        );
    }

    const isAllowed = canAccessByPermissions(scopedPermissions, permissions, mode);

    if (!isAllowed) {
        return <AccessDenied />;
    }

    return <>{children}</>;
};

const renderRouteElement = (route: RouteConfig) => {
    const Component = resolveRouteComponent(route);
    const isDashboardRoute = route.path.startsWith(DASHBOARD_ROUTE_PREFIX);

    return (
        <RoutePermissionGuard route={route}>
            <Suspense
                fallback={(
                    <Loader
                        scale={0.6}
                        label={isDashboardRoute ? 'Loading workspace…' : undefined}
                        announce
                        fillParent={isDashboardRoute}
                    />
                )}
            >
                <Component />
            </Suspense>
        </RoutePermissionGuard>
    );
};

const renderRouteWithChildren = (route: RouteConfig) => {
    const routeElement = renderRouteElement(route);

    if(route.children && route.children.length > 0){
        return (
            <Route
                key={route.path}
                path={route.path}
                element={routeElement}
            >
                {route.children.map((child) => (
                    child.index ? (
                        <Route
                            key={child.path}
                            index
                            element={renderRouteElement(child)}
                        />
                    ) : (
                        <Route
                            key={child.path}
                            path={child.path}
                            element={renderRouteElement(child)}
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
            element={routeElement}
        />
    );
};

export const renderPublicRoutes = () => {
    return publicRoutes.map((route) => renderRouteWithChildren(route));
};

export const renderProtectedRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.Protected} />}>
            {nonDashboardProtectedRoutes.map((route) => renderRouteWithChildren(route))}
            <Route
                path={DASHBOARD_ROUTE_PREFIX}
                element={(
                    <Suspense fallback={<Loader scale={0.6} label='Loading workspace…' announce fillParent />}>
                        <LazyDashboardLayout />
                    </Suspense>
                )}
            >
                {dashboardProtectedRoutes.map((route) => renderRouteWithChildren(route))}
            </Route>
        </Route>
    );
};

export const renderGuestRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.Guest} />}>
            {guestRoutes.map((route) => renderRouteWithChildren(route))}
        </Route>
    );
};

export const renderOptionalAuthRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.OptionalAuth} />}>
            {optionalAuthRoutes.map((route) => renderRouteWithChildren(route))}
        </Route>
    );
};
