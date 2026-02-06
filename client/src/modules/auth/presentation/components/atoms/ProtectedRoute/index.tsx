import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import useTeamData from '@/modules/team/presentation/hooks/team/use-team-data';
import { setGetTeamId } from '@/app/core/http/VoltClient';
import Container from '@/shared/presentation/components/Container';
import './ProtectedRoute.css';

type RouteMode = 'protected' | 'guest';

interface ProtectedRouteProps{
    mode: RouteMode;
};

// Register global teamId getter
setGetTeamId(() => useTeamStore.getState().selectedTeam?._id ?? null);

const ProtectedRoute = ({ mode }: ProtectedRouteProps) => {
    const location = useLocation();
    
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const initializeAuth = useAuthStore((state) => state.initializeAuth);
    
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const teamsLoading = useTeamStore((state) => state.isLoading);

    const { fetchTeams } = useTeamData();

    const isAuthenticated = !!user;
    const hasTeam = !!selectedTeam;

    // Initialize auth on mount if not already initialized
    useEffect(() => {
        if(!isInitialized && !isLoading){
            initializeAuth();
        }
    }, [isInitialized, isLoading, initializeAuth]);

    // Load teams when authenticated
    useEffect(() => {
        if(isAuthenticated && !hasTeam && !teamsLoading){
            fetchTeams();
        }
    }, [isAuthenticated, hasTeam, teamsLoading, fetchTeams]);

    // Show loader while initializing auth or loading teams
    if(!isInitialized || isLoading){
        return (
            <Container className='protected-route-loader d-flex flex-center vh-max w-max'>
                <Container className='protected-route-spinner' />
            </Container>
        );
    }

    // Protected mode: require authentication and team
    if(mode === 'protected'){
        if(!isAuthenticated){
            return <Navigate to='/auth/sign-in' state={{ from: location }} replace />;
        }

        // Wait for team to be loaded/selected
        if(teamsLoading || !hasTeam){
            return (
                <Container className='protected-route-loader d-flex flex-center vh-max w-max'>
                    <Container className='protected-route-spinner' />
                </Container>
            );
        }

        return <Outlet />;
    }

    // Guest mode: redirect authenticated users away
    if(mode === 'guest'){
        if(isAuthenticated){
            return <Navigate to='/dashboard/trajectories' replace />;
        }

        return <Outlet />;
    }

    return <Navigate to='/' replace />;
};

export default ProtectedRoute;
