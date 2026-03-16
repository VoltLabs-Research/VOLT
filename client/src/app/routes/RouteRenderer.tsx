import { routesConfig } from './config';
import ProtectedRoute, { RouteMode } from './ProtectedRoute';
import { canAccessByPermissions } from '@/modules/team/utilities/team/permission-evaluator';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Loader from '@/shared/presentation/components/Loader';
import PageTransition from '@/shared/presentation/components/PageTransition';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ComponentType, ElementType, LazyExoticComponent, ReactNode } from 'react';
import { RoutePermissionMode } from './types';
import type { RouteConfig, RouteLoader } from './types';

interface RoutePermissionGuardProps {
    route: RouteConfig;
    children: ReactNode;
};

const lazyRouteCache = new Map<RouteLoader, LazyExoticComponent<ComponentType>>();

const wrapWithPageTransition = (Component: ElementType) => (
    <PageTransition>
        <Component />
    </PageTransition>
);

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

    if (permissions.length === 0) {
        return <>{children}</>;
    }

    if (!hasHydratedSelection) {
        return <Loader scale={0.6} label='Loading teams…' announce />;
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
        return <Loader scale={0.6} label='Checking access…' announce />;
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

const renderRouteElement = (route: RouteConfig, withTransition = true) => {
    const Component = resolveRouteComponent(route);

    return (
        <RoutePermissionGuard route={route}>
            <Suspense fallback={<Loader scale={0.6} label='Loading workspace…' announce />}>
                {withTransition ? wrapWithPageTransition(Component) : <Component />}
            </Suspense>
        </RoutePermissionGuard>
    );
};

const renderRouteWithChildren = (route: RouteConfig, withTransition = true) => {
    const routeElement = renderRouteElement(route, withTransition);

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
                            element={renderRouteElement(child, withTransition)}
                        />
                    ) : (
                        <Route
                            key={child.path}
                            path={child.path}
                            element={renderRouteElement(child, withTransition)}
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

const renderProtectedRoute = (route: RouteConfig) => renderRouteWithChildren(route);

export const renderPublicRoutes = () => {
    return routesConfig.public.map((route: RouteConfig) => renderRouteWithChildren(route));
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
            {routesConfig.guest.map((route: RouteConfig) => renderRouteWithChildren(route))}
        </Route>
    );
};
