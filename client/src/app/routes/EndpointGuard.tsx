import { hasResolvedBackendEndpoint } from '@/app/core/http/utilities/backend-origin';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

const ENDPOINTLESS_ALLOWED_PATHS = ['/connect', '/error'];

interface EndpointGuardProps {
    children: ReactNode;
};

const EndpointGuard = ({ children }: EndpointGuardProps) => {
    const location = useLocation();

    if (hasResolvedBackendEndpoint() || ENDPOINTLESS_ALLOWED_PATHS.includes(location.pathname)) {
        return <>{children}</>;
    }

    return <Navigate to='/connect' replace />;
};

export default EndpointGuard;
