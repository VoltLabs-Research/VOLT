import { canAccessByPermissions } from '@/modules/team/utils/team/permission-evaluator';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
import AccessDenied from '@/shared/ui/components/AccessDenied';
import { Spinner } from '@heroui/react';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { guestRoutes, optionalAuthRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import ProtectedRoute, { RouteMode } from '@/app/routes/ProtectedRoute';
import { RoutePermissionMode } from '@/app/routes/types';
import { Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { RouteConfig, RouteLoader } from '@/app/routes/types';

/*
 * The route-loading fallback, inline rather than as a component.
 *
 * bravais's `Loader` was a 12-piece CSS spinner with a visible label and an
 * `aria-live` region; HeroUI's `Spinner` covers the visual, so what remains is the
 * announcement and the positioning contract. `fillParent` fills the dashboard's
 * content area; otherwise it covers the viewport, which is what `isFixed` defaulted
 * to. The label is announced politely and atomically so a screen reader hears the
 * whole phrase once rather than character by character.
 */
const renderRouteLoader = (label?: string, fillParent = false) => (
    <div
        className={fillParent ? 'absolute inset-0 flex items-center justify-center' : 'fixed inset-0 flex items-center justify-center'}
        role='status'
        aria-live='polite'
        aria-atomic={true}
        aria-label={label ?? 'Loading'}
    >
        <div className='flex flex-col items-center gap-8'>
            <Spinner size='lg' />
            {label && <span className='text-sm text-muted text-center leading-normal'>{label}</span>}
        </div>
    </div>
);


interface RoutePermissionGuardProps {
    route: RouteConfig;
    children: ReactNode;
};

const lazyRouteCache = new Map<RouteLoader, LazyExoticComponent<ComponentType>>();
const DASHBOARD_ROUTE_PREFIX = '/dashboard';
const dashboardProtectedRoutes = protectedRoutes.filter((route) => route.path.startsWith(DASHBOARD_ROUTE_PREFIX));
const nonDashboardProtectedRoutes = protectedRoutes.filter((route) => !route.path.startsWith(DASHBOARD_ROUTE_PREFIX));
const LazyDashboardLayout = lazy(() => import('@/modules/dashboard/components/DashboardLayout'));

const resolveRouteComponent = (route: RouteConfig): ComponentType => {
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
        return renderRouteLoader('Loading teams…', isDashboardRoute);
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
        return renderRouteLoader('Checking access…', isDashboardRoute);
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
                fallback={renderRouteLoader(isDashboardRoute ? 'Loading workspace…' : undefined, isDashboardRoute)}
            >
                <Component />
            </Suspense>
        </RoutePermissionGuard>
    );
};

const renderRouteWithChildren = (route: RouteConfig) => {
    const routeElement = renderRouteElement(route);

    if(route.children?.length){
        return (
            <Route
                key={route.path}
                path={route.path}
                element={routeElement}
            >
                {route.children.map((child) => (
                    <Route
                        key={child.path}
                        index={child.index}
                        path={child.index ? undefined : child.path}
                        element={renderRouteElement(child)}
                    />
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
    return publicRoutes.map(renderRouteWithChildren);
};

export const renderProtectedRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.Protected} />}>
            {nonDashboardProtectedRoutes.map(renderRouteWithChildren)}
            <Route
                path={DASHBOARD_ROUTE_PREFIX}
                element={(
                    <Suspense fallback={renderRouteLoader('Loading workspace…', true)}>
                        <LazyDashboardLayout />
                    </Suspense>
                )}
            >
                {dashboardProtectedRoutes.map(renderRouteWithChildren)}
            </Route>
        </Route>
    );
};

export const renderGuestRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.Guest} />}>
            {guestRoutes.map(renderRouteWithChildren)}
        </Route>
    );
};

export const renderOptionalAuthRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.OptionalAuth} />}>
            {optionalAuthRoutes.map(renderRouteWithChildren)}
        </Route>
    );
};
