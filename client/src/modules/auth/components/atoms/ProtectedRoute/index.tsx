import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { resetTeamSessionState, useTeamStore } from '@/modules/team/stores/use-team-store';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { setGetTeamId } from '@/app/core/http/client/VoltClient';
import useTeamSocketSubscription from '@/modules/socket/hooks/use-team-socket-subscription';
import useSocketConnectionToast from '@/modules/socket/hooks/use-socket-connection-toast';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import Loader from '@/shared/presentation/components/Loader';

type RouteMode = 'protected' | 'guest';

interface ProtectedRouteProps{
    mode: RouteMode;
};

// Register global teamId getter
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

    // Initialize auth on mount if not already initialized
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

    // Load teams when authenticated
    useEffect(() => {
        if(hasToken && !hasTeam && !isTeamsLoading){
            fetchTeams();
        }
    }, [hasToken, hasTeam, isTeamsLoading, fetchTeams]);

    // Show loader while initializing auth or loading teams
    if(!isInitialized || isLoading){
        return <Loader scale={0.6} />;
    }

    // Protected mode: require authentication and team
    if(mode === 'protected'){
        if(!isAuthenticated){
            return <Navigate to='/auth/sign-in' state={{ from: location }} replace />;
        }

        if (canAccessWithoutSelectedTeam) {
            return <Outlet />;
        }

        // Wait for the initial team list fetch (no cached data yet)
        if(isTeamsLoading && teams.length === 0){
            return <Loader scale={0.6} />;
        }

        if(!hasTeam){
            if (teams.length === 0) {
                return <Navigate to='/start' replace />;
            }

            // Teams loaded but selectedTeamId not yet resolved by useTeamData effect
            return <Loader scale={0.6} />;
        }

        return (
            <>
                <Outlet />
            </>
        );
    }

    // Guest mode: redirect authenticated users away
    if(mode === 'guest'){
        if(isAuthenticated){
            return <Navigate to={hasTeam ? '/dashboard' : '/start'} replace />;
        }

        return <Outlet />;
    }

    return <Navigate to='/' replace />;
};

export default ProtectedRoute;
