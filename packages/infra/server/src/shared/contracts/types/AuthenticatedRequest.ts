import type { HttpRequestContext } from '@shared/http/request-context';
import type { TeamRole } from '@volt/contracts/modules/team/access';
import type { Request } from 'express';

export enum AuthenticationType {
    User = 'user',
    SecretKey = 'secret-key'
}

export interface AuthenticatedRequest extends Request {
    user?: Request['user'];
    userId?: string;
    token?: string;
    authType?: AuthenticationType;
    secretKeyId?: string;
    secretKeyTeamId?: string;
    // The caller's role in the team the request is scoped to, set by checkTeamMembership.
    teamRole?: TeamRole;
    requestContext?: HttpRequestContext;
}
