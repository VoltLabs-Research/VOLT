import { del, get, patch, type EmptyParams } from '@/app/core/http/utilities/create-service';
import type { ActiveSession } from '../../entities/session';
import type { RevokeAllOtherSessionsOutputDTO } from '../../dtos/revoke-all-other-sessions';

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: patch<{ sessionId: string }, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllOtherSessionsOutputDTO>('/all/others', {
        unwrap: 'data'
    })
};

export default endpoints;
