import { hasResolvedBackendEndpoint } from '@/app/core/http/utils/backend-origin';
import { Navigate } from 'react-router-dom';

// VOLT's own root: the landing is a separate site. A deployment that knows its server opens
// sign-in, which sends a signed-in user on to the dashboard; one that does not asks for a server.
const HomeRedirect = () => (
    <Navigate to={hasResolvedBackendEndpoint() ? '/auth/sign-in' : '/connect'} replace />
);

export default HomeRedirect;
