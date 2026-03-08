import { del, get, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { ActiveSession } from '../../entities/session';
import type { RevokeAllOtherSessionsOutputDTO } from '../../dtos/revoke-all-other-sessions';

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: del<{ sessionId: string }, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllOtherSessionsOutputDTO>('/', {
        unwrap: 'data'
    })
};

export default endpoints;
