
import { createService, del, get } from '@/app/core/http/utils/create-service';
import type { ActiveSession } from '@volt/contracts/modules/session/domain';
import type { EmptyParams } from '@voltstack/voltclient';
import type { GetLoginActivityResponse } from '@volt/contracts/modules/session/domain';

interface GetLoginActivityInput {
    limit?: number;
}

export interface RevokeAllOtherSessionsResponse {
    revokedCount: number;
}

export interface RevokeSessionInput {
    sessionId: string;
}

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: del<RevokeSessionInput, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllOtherSessionsResponse>('/', {
        unwrap: 'data'
    }),
    getLoginActivity: get<GetLoginActivityInput | undefined, GetLoginActivityResponse>('/activity', {
        query: (params) => ({ limit: params?.limit ?? 20 })
    })
};

export default createService({
    clients: {
        default: {
            basePath: '/sessions'
        }
    }
}, endpoints);
