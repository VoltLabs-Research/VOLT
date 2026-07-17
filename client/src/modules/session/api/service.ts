
import { createService, del, get } from '@/app/core/http/utilities/create-service';
import type { ActiveSession, LoginActivityEntry } from './types/session';
import type { EmptyParams } from '@voltstack/voltclient';

export interface GetLoginActivityInput {
    limit?: number;
}

export interface GetLoginActivityResponse {
    activities: LoginActivityEntry[];
    total: number;
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
