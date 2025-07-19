import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../../stores/authentication';
import Loader from '../Loader';
import './ProtectedRoute.css';

type UserRole = 'user' | 'admin';

interface ProtectedRouteProps {
    mode: 'protect' | 'guest';
    restrictTo?: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ mode, restrictTo }) => {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const isLoading = useAuthStore((state) => state.isLoading);
    const isAuthenticated = !!user;

    if(isLoading){
        return (
            <main className='auth-loading-main'>
                <Loader scale='0.6' />
            </main>
        );
    }

    if(mode === 'protect' && restrictTo){
        if(!isAuthenticated || user.role !== restrictTo) {
            return <Navigate to="/auth/sign-up" replace />;
        }
        return <Outlet />;
    }

    if(mode === 'protect'){
        if(!isAuthenticated){
            return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
        }
        return <Outlet />;
    }

    if(mode === 'guest'){
        if(isAuthenticated){
            return <Navigate to="/dashboard" replace />;
        }
        return <Outlet />;
    }

    return <Navigate to="/" replace />;
};

export default ProtectedRoute;