import { get, del } from '../../shared/routing';
import type {
    PersistedSession,
    GetLoginActivityResponse,
    RevokeAllSessionsResponse
} from './domain';

export const sessionRoutes = {
    getActiveSessions: get<PersistedSession[]>('/api/sessions'),
    getLoginActivity: get<GetLoginActivityResponse>('/api/sessions/activity'),
    revokeSession: del('/api/sessions/:sessionId'),
    revokeAllSessions: del<RevokeAllSessionsResponse>('/api/sessions')
} as const;
