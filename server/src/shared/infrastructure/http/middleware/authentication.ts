import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import { isPopulatedSecretKeyRole } from '@modules/team/domain/entities/secret-key/SecretKey';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import type { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/secret-key/ISecretKeyUsageLogRepository';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { ErrorCodes } from '@core/constants/error-codes';
import type { NextFunction, Request, Response } from 'express';
import { container } from 'tsyringe';

export enum AuthenticationType {
    User = 'user',
    SecretKey = 'secret-key'
};

export interface AuthenticatedRequest extends Request {
    user?: Request['user'];
    userId?: string;
    sessionId?: string;
    token?: string;
    authType?: AuthenticationType;
    secretKeyId?: string;
    secretKeyTeamId?: string;
    secretKeyRoleId?: string;
    /** Cached permissions from checkTeamMembership (populated role) */
    teamPermissions?: string[];
};

export const protect = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (
        (req.authType === AuthenticationType.SecretKey && req.token && req.secretKeyId && req.secretKeyTeamId)
        || (req.authType === AuthenticationType.User && req.token && req.userId && req.user)
    ) {
        next();
        return;
    }

    const authorizationHeader = req.headers.authorization;
    const token = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.split(' ')[1]
        : undefined;

    if (!token) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_REQUIRED, 401, ErrorCodes.AUTHENTICATION_REQUIRED);
        return;
    }

    if (token.startsWith('vsk_')) {
        const startTime = Date.now();
        const secretKeyRepository = container.resolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository);
        const secretKey = await secretKeyRepository.findActiveByRawKey(token);

        if (!secretKey) {
            BaseResponse.error(res, ErrorCodes.SECRET_KEY_INVALID, 401, ErrorCodes.SECRET_KEY_INVALID);
            return;
        }

        const role = isPopulatedSecretKeyRole(secretKey.props.role)
            ? secretKey.props.role
            : undefined;
        const createdById = secretKey.getCreatedById();

        req.authType = AuthenticationType.SecretKey;
        req.token = token;
        req.secretKeyId = secretKey.id;
        req.secretKeyTeamId = String(secretKey.props.team);
        req.secretKeyRoleId = role?._id?.toString?.() || secretKey.getRoleId();
        req.teamPermissions = Array.isArray(role?.permissions)
            ? role.permissions
            : [];
        req.userId = createdById;

        await secretKeyRepository.touchLastUsed(secretKey.id);

        res.on('finish', () => {
            const usageLogRepository = container.resolve<ISecretKeyUsageLogRepository>(TEAM_TOKENS.SecretKeyUsageLogRepository);
            const userAgentHeader = req.headers['user-agent'];
            usageLogRepository.logRequest({
                secretKey: secretKey.id,
                team: String(secretKey.props.team),
                method: req.method,
                path: req.route?.path || req.originalUrl || req.path,
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                ip: req.ip || req.socket.remoteAddress || 'unknown',
                userAgent: (Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader) || 'unknown'
            }).catch((err) => {
                logger.warn(err, '@authentication: failed to log secret key usage');
            });
        });

        next();
        return;
    }

    const tokenService = container.resolve<ITokenService>(AUTH_TOKENS.TokenService);
    const decoded = tokenService.verify(token);
    if (!decoded) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return;
    }

    const userRepository = container.resolve<IUserRepository>(AUTH_TOKENS.UserRepository);
    const user = await userRepository.findById(decoded.id);
    if (!user) {
        BaseResponse.error(res, ErrorCodes.USER_NOT_FOUND, 401, ErrorCodes.USER_NOT_FOUND);
        return;
    }

    if (user.isPasswordChangedAfterTokenIssued(decoded.iat ?? 0)) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return;
    }

    req.authType = AuthenticationType.User;
    req.user = user;
    req.userId = user.id;
    req.token = token;

    next();
};
