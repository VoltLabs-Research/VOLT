import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { setGetTeamId } from '@/app/core/http/client/VoltClient';
import { resetTeamSessionState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamSocketSubscription from '@/modules/team/hooks/team/use-team-socket-subscription';
import useSocketConnectionToast from '@/modules/socket/core/hooks/use-socket-connection-toast';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export enum RouteMode {
    Protected = 'protected',
    Guest = 'guest'
};

interface ProtectedRouteProps{
    mode: RouteMode;
};

setGetTeamId(() => useTeamStore.getState().selectedTeamId ?? null);

const ProtectedRoute = ({ mode }: ProtectedRouteProps) => {
    const location = useLocation();

    const user = useCurrentUser();
    const isLoading = useAuthStore((state) => state.isLoading);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const hasToken = useAuthStore((state) => state.hasToken);
    const initializeAuth = useAuthStore((state) => state.initializeAuth);

    const selectedTeamId = useSelectedTeamId();

    const { teams, fetchTeams, isTeamsLoading } = useTeamData();

    useTeamSocketSubscription();
    useSocketConnectionToast();
    useTeamPresenceSocket();
    useTeamActivityHeartbeat();

    const isAuthenticated = !!user;
    const hasTeam = !!selectedTeamId;
    const isStartRoute = location.pathname === '/start';
    const isTeamInvitationRoute = location.pathname.startsWith('/team-invitation/');
    const canAccessWithoutSelectedTeam = isStartRoute || isTeamInvitationRoute;

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

    if(!isInitialized || isLoading){
        return <Loader scale={0.6} />;
    }

    if(mode === RouteMode.Protected){
        if(!isAuthenticated){
            return <Navigate to='/auth/sign-in' state={{ from: location }} replace />;
        }

        if (canAccessWithoutSelectedTeam) {
            return <Outlet />;
        }

        if(isTeamsLoading && teams.length === 0){
            return <Loader scale={0.6} />;
        }

        if(!hasTeam){
            if (teams.length === 0) {
                return <Navigate to='/start' replace />;
            }

            return <Loader scale={0.6} />;
        }

        return <Outlet />;
    }

    if(mode === RouteMode.Guest){
        if(isAuthenticated){
            return <Navigate to={hasTeam ? '/dashboard' : '/start'} replace />;
        }

        return <Outlet />;
    }

    return <Navigate to='/' replace />;
};

export default ProtectedRoute;
