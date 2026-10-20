import { get, del } from '../../shared/routing';
import type {
    ActiveSession,
    GetLoginActivityResponse,
    RevokeAllSessionsResponse
} from './domain';

export const sessionRoutes = {
    getActiveSessions: get<ActiveSession[]>('/api/sessions'),
    getLoginActivity: get<GetLoginActivityResponse>('/api/sessions/activity'),
    revokeSession: del('/api/sessions/:sessionId'),
    revokeAllSessions: del<RevokeAllSessionsResponse>('/api/sessions')
} as const;
