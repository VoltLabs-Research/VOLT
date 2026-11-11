import Loader from '@/shared/ui/components/Loader';
import { roleNeededFor } from '@/modules/team/utils/team/team-access';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamStore } from '@/modules/team/store/team/use-team-store';
import AccessDenied from '@/shared/ui/components/AccessDenied';

import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import useTeamAccess from '@/modules/team/hooks/team/use-team-access';
import { guestRoutes, optionalAuthRoutes, protectedRoutes, publicRoutes } from '@/app/routes/definitions';
import ProtectedRoute, { RouteMode } from '@/app/routes/ProtectedRoute';
import { localStackMode } from '@/modules/local-stack/services/local-stack-mode';
import { Navigate, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent, ReactNode } from 'react';
import type { RouteConfig, RouteLoader } from '@/app/routes/types';

const renderRouteLoader = (label?: string, fillParent = false) => (
    <div
        className={fillParent ? 'absolute inset-0 flex items-center justify-center' : 'fixed inset-0 flex items-center justify-center'}
        role='status'
        aria-live='polite'
        aria-atomic={true}
        aria-label={label ?? 'Loading'}
    >
        <div className='flex flex-col items-center gap-8'>
            <Loader size='lg' />
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
    const { meets, isScopeReady, isLoading: isRoleLoading } = useTeamAccess();
    const requirements = route.requiredAccess ?? [];
    const isDashboardRoute = route.path.startsWith(DASHBOARD_ROUTE_PREFIX);

    if (route.requiresMachine && localStackMode.isEnabled()) {
        return <Navigate to={DASHBOARD_ROUTE_PREFIX} replace />;
    }

    if (requirements.length === 0) {
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

    if (isRoleLoading) {
        return renderRouteLoader('Checking access…', isDashboardRoute);
    }

    if (!isScopeReady) {
        return (
            <RecoveryState
                title='Preparing workspace access'
                description='We are still loading your role in this team. Please wait a moment.'
                tone={RecoveryStateTone.Info}
            />
        );
    }

    if (!meets(requirements)) {
        return <AccessDenied requiredRole={roleNeededFor(requirements)} />;
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

const renderSignedInRoutes = () => (
    <>
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
    </>
);

export const renderProtectedRoutes = () => {
    return (
        <Route element={<ProtectedRoute mode={RouteMode.Protected} />}>
            {renderSignedInRoutes()}
        </Route>
    );
};

// The workspace's pages without the session around them, for a document that renders them
// from data of its own: the landing's screens.
export const renderWorkspaceRoutes = () => (
    <>
        {optionalAuthRoutes.map(renderRouteWithChildren)}
        {renderSignedInRoutes()}
    </>
);

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
