import type { HttpRequestContext } from '@shared/infrastructure/http/request-context';
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
    secretKeyRoleId?: string;
    teamPermissions?: string[];
    requestContext?: HttpRequestContext;
}
