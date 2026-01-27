import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import './ProtectedRoute.css';

type UserRole = 'user' | 'admin';

interface ProtectedRouteProps {
    mode: 'protect' | 'guest';
    restrictTo?: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ mode, restrictTo }) => {
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;
    const isLoading = useAuthStore((state) => state.isLoading);

    if (isLoading) return;

    if (mode === 'protect') {
        if (!isAuthenticated) {
            return <Navigate to="/auth/sign-in" state={{ from: location }} replace />;
        }

        if (restrictTo && user.role !== restrictTo) {
            return <Navigate to='/dashboard' replace />;
        }

        return <Outlet />;
    }

    if (mode === 'guest') {
        if (isAuthenticated) {
            return <Navigate to='/dashboard' replace />;
        }

        return <Outlet />;
    }

    return <Navigate to='/' replace />;
};

export default ProtectedRoute;
