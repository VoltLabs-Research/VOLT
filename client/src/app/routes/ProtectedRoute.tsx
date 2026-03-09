import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useAuthStore } from '@/modules/auth/stores/use-auth-store';
import { setGetTeamId } from '@/app/core/http/client/VoltClient';
import { resetTeamSessionState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import ConfirmActionModal from '@/shared/presentation/components/ConfirmActionModal';
import useTeamSocketSubscription from '@/modules/team/hooks/team/use-team-socket-subscription';
import useSocketConnectionToast from '@/modules/socket/core/hooks/use-socket-connection-toast';
import useTeamActivityHeartbeat from '@/modules/team/hooks/team/use-team-activity-heartbeat';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTeamPresenceSocket from '@/modules/team/hooks/team/use-team-presence-socket';
import Loader from '@/shared/presentation/components/Loader';
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

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

    const shouldLoadTeamData = mode === RouteMode.Protected && hasToken;
    const { teams, fetchTeams, isTeamsLoading } = useTeamData({ enabled: shouldLoadTeamData });

    useTeamSocketSubscription();
    useSocketConnectionToast();
    useTeamPresenceSocket();
    useTeamActivityHeartbeat();

    const teamClustersQuery = useTeamClustersQuery(selectedTeamId ?? '', {
        enabled: Boolean(selectedTeamId)
    });
    const teamClusters = teamClustersQuery.data?.data ?? [];
    const hasConnectedCluster = teamClusters.some((c) => c.status === TeamClusterStatus.Connected);
    const isClusterCheckLoading = teamClustersQuery.isLoading;
    const shouldRedirectToOnboarding = !isClusterCheckLoading && !hasConnectedCluster;

    const isAuthenticated = !!user;
    const hasTeam = !!selectedTeamId;
    const isStartRoute = location.pathname === '/start';
    const isTeamInvitationRoute = location.pathname.startsWith('/team-invitation/');
    const isClusterOnboardingRoute = location.pathname === '/onboarding/cluster/setup';
    const isDashboardRoute = location.pathname === '/dashboard' || location.pathname.startsWith('/dashboard/');
    const canAccessWithoutSelectedTeam = isStartRoute || isTeamInvitationRoute;
    const canAccessWithoutCluster = canAccessWithoutSelectedTeam || isClusterOnboardingRoute;

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

    if(!isInitialized || isLoading){
        return renderProtectedContent(<Loader scale={0.6} />);
    }

    if(mode === RouteMode.Protected){
        if(!isAuthenticated){
            return renderProtectedContent(<Navigate to='/auth/sign-in' state={{ from: location }} replace />);
        }

        if (canAccessWithoutSelectedTeam) {
            return renderProtectedContent(<Outlet />);
        }

        if(isTeamsLoading && teams.length === 0){
            return renderProtectedContent(<Loader scale={0.6} />);
        }

        if(!hasTeam){
            if (teams.length === 0) {
                if (isDashboardRoute) {
                    return renderProtectedContent(<Outlet />);
                }

                return renderProtectedContent(<Navigate to='/dashboard' replace />);
            }

            return renderProtectedContent(<Loader scale={0.6} />);
        }

        if (!canAccessWithoutCluster) {
            if (isClusterCheckLoading) {
                return renderProtectedContent(<Loader scale={0.6} />);
            }

            if (shouldRedirectToOnboarding) {
                return renderProtectedContent(<Navigate to='/onboarding/cluster/setup' replace />);
            }
        }

        return renderProtectedContent(<Outlet />);
    }

    if(mode === RouteMode.Guest){
        if(isAuthenticated){
            return renderProtectedContent(<Navigate to='/dashboard' replace />);
        }

        return renderProtectedContent(<Outlet />);
    }

    return renderProtectedContent(<Navigate to='/' replace />);
};

export default ProtectedRoute;
