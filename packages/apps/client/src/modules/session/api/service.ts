
import { createService, del, get } from '@/app/core/http/utils/create-service';
import type { ActiveSession } from '@volt/contracts/modules/session/domain';
import type { EmptyParams } from '@voltstack/voltclient';
import type { GetLoginActivityResponse, RevokeAllSessionsResponse } from '@volt/contracts/modules/session/domain';

const LOGIN_ACTIVITY_LIMIT = 20;

export interface RevokeSessionInput {
    sessionId: string;
}

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: del<RevokeSessionInput, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllSessionsResponse>('/', {
        unwrap: 'data'
    }),
    getLoginActivity: get<EmptyParams, GetLoginActivityResponse>('/activity', {
        query: () => ({ limit: LOGIN_ACTIVITY_LIMIT })
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/sessions'
        }
    }
}, endpoints);
