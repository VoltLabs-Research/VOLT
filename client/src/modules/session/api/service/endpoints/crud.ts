import { del, get } from '@/app/core/http/utilities/create-service';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { RevokeSessionInputDTO } from '../../dtos/revoke-session';
import type { ActiveSession } from '../../entities/session';
import type { RevokeAllOtherSessionsOutputDTO } from '../../dtos/revoke-all-other-sessions';

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: del<RevokeSessionInputDTO, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllOtherSessionsOutputDTO>('/', {
        unwrap: 'data'
    })
};

export default endpoints;
