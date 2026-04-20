import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { reportHotspotDuration } from '@/app/core/http/utilities/client-instrumentation';
import {
    getClusterOnboardingRedirectPath,
    getOnboardingRedirectPath,
    resolvePostAuthDestination,
    setPostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import socketService from '@/modules/socket/core/services/socket-service';
import { setGetTeamId } from '@/app/core/http/utilities/create-client';
import { hasUsableTeamCluster } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { resetTeamSessionState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import ProtectedRouteRealtimeEffects from '@/app/routes/ProtectedRouteRealtimeEffects';
import ConfirmActionModal from '@/shared/presentation/components/ConfirmActionModal';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps{
    mode: RouteMode;
};

interface RouteReadyMeasurement {
    key: string;
    startedAt: number;
};

export enum RouteMode {
    Protected = 'protected',
    Guest = 'guest',
    OptionalAuth = 'optional-auth'
};

setGetTeamId(() => useTeamStore.getState().selectedTeamId ?? null);

const ProtectedRoute = ({ mode }: ProtectedRouteProps) => {
    const location = useLocation();
    const currentDestination = location.pathname + location.search + location.hash;
    const queryNext = new URLSearchParams(location.search).get('next');

    const user = useCurrentUser();
    const isLoading = useAuthStore((state) => state.isLoading);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const hasToken = useAuthStore((state) => state.hasToken);
    const initializeAuth = useAuthStore((state) => state.initializeAuth);

    const selectedTeamId = useSelectedTeamId();

    const shouldLoadTeamData = mode === RouteMode.Protected && hasToken;
    const { teams, isTeamsLoading } = useTeamData({ enabled: shouldLoadTeamData });
    const previousSelectedTeamIdRef = useRef<string | null>(selectedTeamId);
    const refreshedOnboardingTeamIdRef = useRef<string | null>(null);

    const isAuthenticated = !!user;
    const hasTeam = !!selectedTeamId;
    const isStartRoute = location.pathname === '/start';
    const isOnboardingRoute = location.pathname === '/onboarding' || location.pathname.startsWith('/onboarding/');
    const isTeamInvitationRoute = location.pathname.startsWith('/team-invitation/');
    const canAccessWithoutSelectedTeam = isStartRoute || isTeamInvitationRoute || isOnboardingRoute;

    const shouldCheckTeamClusterAccess = mode === RouteMode.Protected
        && hasToken
        && isAuthenticated
        && !canAccessWithoutSelectedTeam
        && Boolean(selectedTeamId);
    const shouldMountRealtimeEffects = (mode === RouteMode.Protected || mode === RouteMode.OptionalAuth)
        && hasToken
        && isAuthenticated;

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: shouldCheckTeamClusterAccess
    });
    const isClusterCheckLoading = teamClustersQuery.isLoading;
    const shouldRedirectToOnboarding = teamClustersQuery.isSuccess
        && !hasUsableTeamCluster(teamClustersQuery.data.data);
    const routeReadyRef = useRef<RouteReadyMeasurement | null>(null);
    const routeReadyKey = `${mode}:${currentDestination}`;
    const isRouteSettled = mode === RouteMode.Protected
        ? isInitialized
            && !isLoading
            && (
                !isAuthenticated
                || canAccessWithoutSelectedTeam
                || (
                    !isTeamsLoading
                    && hasTeam
                    && !isClusterCheckLoading
                    && !shouldRedirectToOnboarding
                )
            )
        : isInitialized && !isLoading;

    const renderProtectedContent = (content: ReactNode) => {
        return (
            <>
                {shouldMountRealtimeEffects && <ProtectedRouteRealtimeEffects />}
                <ConfirmActionModal />
                {content}
            </>
        );
    };

    useEffect(() => {
        routeReadyRef.current = {
            key: routeReadyKey,
            startedAt: performance.now()
        };
    }, [routeReadyKey]);

    useEffect(() => {
        if (!isRouteSettled || routeReadyRef.current?.key !== routeReadyKey) {
            return;
        }

        reportHotspotDuration('protected-route.bootstrap', routeReadyRef.current.startedAt, {
            mode,
            path: location.pathname
        });
        routeReadyRef.current = null;
    }, [isRouteSettled, location.pathname, mode, routeReadyKey]);

    useEffect(() => {
        if(!isInitialized && !isLoading){
            initializeAuth();
        }
    }, [isInitialized, isLoading, initializeAuth]);

    useEffect(() => {
        if (!isInitialized || isAuthenticated) {
            return;
        }

        resetTeamSessionState();
    }, [isAuthenticated, isInitialized]);

    useEffect(() => {
        const previousSelectedTeamId = previousSelectedTeamIdRef.current;
        previousSelectedTeamIdRef.current = selectedTeamId;

        if (
            mode !== RouteMode.Protected
            || !hasToken
            || !isAuthenticated
            || !isOnboardingRoute
            || !selectedTeamId
            || previousSelectedTeamId
            || refreshedOnboardingTeamIdRef.current === selectedTeamId
        ) {
            return;
        }

        refreshedOnboardingTeamIdRef.current = selectedTeamId;
        refreshSocketSession();
    }, [hasToken, isAuthenticated, isOnboardingRoute, mode, selectedTeamId]);

    useEffect(() => {
        if (mode !== RouteMode.Protected || !hasToken || !isAuthenticated) {
            return;
        }

        const ensureSocketConnection = () => {
            socketService.connect().catch(() => undefined);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                ensureSocketConnection();
            }
        };

        ensureSocketConnection();
        window.addEventListener('online', ensureSocketConnection);
        window.addEventListener('focus', ensureSocketConnection);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', ensureSocketConnection);
            window.removeEventListener('focus', ensureSocketConnection);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [hasToken, isAuthenticated, mode]);

    if(!isInitialized || isLoading){
        return renderProtectedContent(<Loader scale={0.6} label='Loading workspace…' announce />);
    }

    if(mode === RouteMode.Protected){
        if(!isAuthenticated){
            setPostAuthDestination(currentDestination);

            return renderProtectedContent(
                <Navigate
                    to={`/auth/sign-in?next=${encodeURIComponent(currentDestination)}`}
                    replace
                />
            );
        }

        if (canAccessWithoutSelectedTeam) {
            return renderProtectedContent(<Outlet />);
        }

        if(isTeamsLoading && teams.length === 0){
            return renderProtectedContent(<Loader scale={0.6} label='Loading teams…' announce />);
        }

        if(!hasTeam){
            if (teams.length === 0) {
                return renderProtectedContent(
                    <Navigate to={getOnboardingRedirectPath(currentDestination)} replace />
                );
            }

            return renderProtectedContent(<Loader scale={0.6} label='Loading teams…' announce />);
        }

        if (isClusterCheckLoading) {
            return renderProtectedContent(<Loader scale={0.6} label='Checking cluster access…' announce />);
        }

        if (shouldRedirectToOnboarding) {
            return renderProtectedContent(
                <Navigate to={getClusterOnboardingRedirectPath(currentDestination)} replace />
            );
        }

        return renderProtectedContent(<Outlet />);
    }

    if (mode === RouteMode.OptionalAuth) {
        return renderProtectedContent(<Outlet />);
    }

    if(isAuthenticated){
        const destination = resolvePostAuthDestination({ queryNext });

        return renderProtectedContent(<Navigate to={destination} replace />);
    }

    return renderProtectedContent(<Outlet />);
};

export default ProtectedRoute;
