import { ErrorCodes } from '@core/constants/error-codes';
import { NextFunction, Request, Response } from 'express';
import { container } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ISecretKeyRepository } from '@modules/team/domain/ports/ISecretKeyRepository';
import jwt from 'jsonwebtoken';

export interface AuthenticatedRequest extends Request {
    user?: any;
    userId?: string;
    sessionId?: string;
    token?: string;
    authType?: 'user' | 'secret-key';
    secretKeyId?: string;
    secretKeyTeamId?: string;
    secretKeyRoleId?: string;
    /** Cached permissions from checkTeamMembership (populated role) */
    teamPermissions?: string[];
};

const getBearerToken = (authorizationHeader?: string): string | undefined => {
    if (!authorizationHeader?.startsWith('Bearer ')) {
        return undefined;
    }
    return authorizationHeader.split(' ')[1];
};

const respondUnauthorized = (res: Response, message: string): void => {
    res.status(401).json({
        status: 'error',
        message
    });
};

export const protect = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
        respondUnauthorized(res, ErrorCodes.AUTHENTICATION_REQUIRED);
        return;
    }

    if (token.startsWith('vsk_')) {
        const secretKeyRepository = container.resolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository);
        const secretKey = await secretKeyRepository.findActiveByRawKey(token);

        if (!secretKey) {
            respondUnauthorized(res, ErrorCodes.SECRET_KEY_INVALID);
            return;
        }

        const role = secretKey.props.role as any;
        const createdBy = secretKey.props.createdBy as any;
        const createdById = typeof createdBy === 'string'
            ? createdBy
            : createdBy?._id?.toString?.();

        req.authType = 'secret-key';
        req.token = token;
        req.secretKeyId = secretKey.id;
        req.secretKeyTeamId = String(secretKey.props.team);
        req.secretKeyRoleId = role?._id?.toString?.() || String(secretKey.props.role || '');
        req.teamPermissions = Array.isArray(role?.permissions)
            ? role.permissions
            : [];
        req.userId = createdById;

        await secretKeyRepository.touchLastUsed(secretKey.id);
        next();
        return;
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, process.env.SECRET_KEY!) as any;
    } catch {
        respondUnauthorized(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return;
    }

    const userRepository = container.resolve<IUserRepository>(AUTH_TOKENS.UserRepository);
    const user = await userRepository.findById(decoded.id);
    if (!user) {
        respondUnauthorized(res, ErrorCodes.USER_NOT_FOUND);
        return;
    }

    req.authType = 'user';
    req.user = user;
    req.userId = user.id;
    req.token = token;

    next();
};
