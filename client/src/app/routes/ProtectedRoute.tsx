import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import {
    getClusterOnboardingRedirectPath,
    getOnboardingRedirectPath,
    resolvePostAuthDestination,
    setPostAuthDestination
} from '@/modules/auth/services/post-auth-destination-storage';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { setGetTeamId } from '@/app/core/http/utilities/create-client';
import { hasUsableTeamCluster } from '@/modules/cluster/utilities/is-team-cluster-usable';
import { resetTeamSessionState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import ConfirmActionModal from '@/shared/presentation/components/ConfirmActionModal';
import useTeamSocketSubscription from '@/modules/team/hooks/team/use-team-socket-subscription';
import useSocketConnectionToast from '@/modules/socket/core/hooks/use-socket-connection-toast';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface ProtectedRouteProps{
    mode: RouteMode;
};

export enum RouteMode {
    Protected = 'protected',
    Guest = 'guest'
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
    const { teams, fetchTeams, isTeamsLoading } = useTeamData({ enabled: shouldLoadTeamData });
    const previousSelectedTeamIdRef = useRef<string | null>(selectedTeamId);
    const refreshedOnboardingTeamIdRef = useRef<string | null>(null);

    useTeamSocketSubscription();
    useSocketConnectionToast();
    useTeamPresenceSocket();
    useTeamActivityHeartbeat();

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const isClusterCheckLoading = teamClustersQuery.isLoading;
    const shouldRedirectToOnboarding = teamClustersQuery.isSuccess
        && !hasUsableTeamCluster(teamClustersQuery.data.data);

    const isAuthenticated = !!user;
    const hasTeam = !!selectedTeamId;
    const isStartRoute = location.pathname === '/start';
    const isOnboardingRoute = location.pathname === '/onboarding' || location.pathname.startsWith('/onboarding/');
    const isTeamInvitationRoute = location.pathname.startsWith('/team-invitation/');
    const canAccessWithoutSelectedTeam = isStartRoute || isTeamInvitationRoute || isOnboardingRoute;

    const renderProtectedContent = (content: ReactNode) => {
        return (
            <>
                <ConfirmActionModal />
                {content}
            </>
        );
    };

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
        if(hasToken && !hasTeam && !isTeamsLoading){
            fetchTeams();
        }
    }, [hasToken, hasTeam, isTeamsLoading, fetchTeams]);

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

    if(isAuthenticated){
        const destination = resolvePostAuthDestination({ queryNext });

        return renderProtectedContent(<Navigate to={destination} replace />);
    }

    return renderProtectedContent(<Outlet />);
};

export default ProtectedRoute;
