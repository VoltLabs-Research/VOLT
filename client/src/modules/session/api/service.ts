
import { createService, del, get } from '@/app/core/http/utilities/create-service';
import type { ActiveSession, LoginActivityEntry } from './entities/session';
import type { EmptyParams } from '@voltstack/voltclient';

export interface GetLoginActivityInputDTO {
    limit?: number;
}

export interface GetLoginActivityOutputDTO {
    activities: LoginActivityEntry[];
    total: number;
}

export interface RevokeAllOtherSessionsOutputDTO {
    revokedCount: number;
}

export interface RevokeSessionInputDTO {
    sessionId: string;
}

const endpoints = {
    getActiveSessions: get<EmptyParams, ActiveSession[]>('/'),
    revokeSession: del<RevokeSessionInputDTO, void>('/:sessionId', { unwrap: 'void' }),
    revokeAllOtherSessions: del<EmptyParams, RevokeAllOtherSessionsOutputDTO>('/', {
        unwrap: 'data'
    }),
    getLoginActivity: get<GetLoginActivityInputDTO | undefined, GetLoginActivityOutputDTO>('/activity', {
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
