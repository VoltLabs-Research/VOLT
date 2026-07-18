import { get, del } from '../../shared/routing';
import type {
    PersistedSession,
    GetLoginActivityResponse,
    RevokeAllSessionsResponse
} from './domain';

/**
 * Every client-facing session endpoint, typed by request/response. All paths
 * are the full wire paths (`/api/sessions`), matching the previous
 * `createHttpModule({ basePath: '/api/sessions', protected: true })` routing
 * verbatim. Order matters for the controller: the literal `/activity` route is
 * declared before the `/:sessionId` param route so Express matches it first.
 */
export const sessionRoutes = {
    getActiveSessions: get<PersistedSession[]>('/api/sessions'),
    getLoginActivity: get<GetLoginActivityResponse>('/api/sessions/activity'),
    revokeSession: del('/api/sessions/:sessionId'),
    revokeAllSessions: del<RevokeAllSessionsResponse>('/api/sessions')
} as const;
