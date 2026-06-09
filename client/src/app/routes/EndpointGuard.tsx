import { hasResolvedBackendEndpoint } from '@/app/core/http/utilities/backend-origin';
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

// `/canvas/glb` is the local GLB viewer: it renders an asset passed via `?url=` /
// `?manifest=` entirely client-side (e.g. voltsdk's open_in_volt) and never calls the
// backend, so it must be reachable without a connected endpoint.
const ENDPOINTLESS_ALLOWED_PATHS = ['/connect', '/error', '/canvas/glb'];

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
