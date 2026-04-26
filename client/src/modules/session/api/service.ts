
import { createService, del, get } from '@/app/core/http/utilities/create-service';
import type { ActiveSession } from './entities/session';
import type { EmptyParams } from '@/app/core/http/utilities/create-service';
import type { GetLoginActivityInputDTO, GetLoginActivityOutputDTO } from './dtos/get-login-activity';
import type { RevokeAllOtherSessionsOutputDTO } from './dtos/revoke-all-other-sessions';
import type { RevokeSessionInputDTO } from './dtos/revoke-session';

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
