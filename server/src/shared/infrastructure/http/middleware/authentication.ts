import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { ITokenService } from '@modules/auth/domain/port/ITokenService';
import { SESSION_TOKENS } from '@modules/session/infrastructure/di/SessionTokens';
import type { ISessionRepository } from '@modules/session/domain/port/ISessionRepository';
import { isPopulatedSecretKeyRole } from '@modules/team/domain/entities/secret-key/SecretKey';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { ISecretKeyRepository } from '@modules/team/domain/port/secret-key/ISecretKeyRepository';
import type { ISecretKeyUsageLogRepository } from '@modules/team/domain/port/secret-key/ISecretKeyUsageLogRepository';
import {
    HttpRequestAuthType,
    setHttpRequestContextAuth,
    type HttpRequestAuthContext,
    type HttpRequestContext
} from '@shared/infrastructure/http/request-context';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import { ErrorCodes } from '@core/constants/error-codes';
import { container } from 'tsyringe';

import type { NextFunction, Request, Response } from 'express';

export enum AuthenticationType {
    User = 'user',
    SecretKey = 'secret-key'
};

export interface AuthenticatedRequest extends Request {
    user?: Request['user'];
    userId?: string;
    token?: string;
    authType?: AuthenticationType;
    secretKeyId?: string;
    secretKeyTeamId?: string;
    secretKeyRoleId?: string;
    /** Cached permissions from checkTeamMembership (populated role) */
    teamPermissions?: string[];
    requestContext?: HttpRequestContext;
};

const setRequestAuthContext = (
    request: AuthenticatedRequest,
    authContext: HttpRequestAuthContext
): void => {
    if (request.requestContext) {
        request.requestContext.auth = authContext;
    }

    setHttpRequestContextAuth(authContext);
};

const isAuthenticatedRequest = (req: AuthenticatedRequest): boolean => {
    return (
        (req.authType === AuthenticationType.SecretKey && req.token !== undefined && req.secretKeyId !== undefined && req.secretKeyTeamId !== undefined)
        || (req.authType === AuthenticationType.User && req.token !== undefined && req.userId !== undefined && req.user !== undefined)
    );
};

const getBearerToken = (req: AuthenticatedRequest): string | undefined => {
    const authorizationHeader = req.headers.authorization;

    return authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.split(' ')[1]
        : undefined;
};

const authenticateWithSecretKey = async (
    req: AuthenticatedRequest,
    res: Response,
    token: string
): Promise<boolean> => {
    const startTime = Date.now();
    const secretKeyRepository = container.resolve<ISecretKeyRepository>(TEAM_TOKENS.SecretKeyRepository);
    const secretKey = await secretKeyRepository.findActiveByRawKey(token);

    if (!secretKey) {
        BaseResponse.error(res, ErrorCodes.SECRET_KEY_INVALID, 401, ErrorCodes.SECRET_KEY_INVALID);
        return false;
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

    const authContext: HttpRequestAuthContext = {
        authType: HttpRequestAuthType.SecretKey,
        subjectId: secretKey.id,
        durationMs: Date.now() - startTime,
        cached: false
    };

    setRequestAuthContext(req, authContext);
    logger.info({
        traceId: req.requestContext?.traceId,
        authType: AuthenticationType.SecretKey,
        secretKeyId: secretKey.id,
        teamId: req.secretKeyTeamId,
        durationMs: authContext.durationMs
    }, '@authentication');

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

    return true;
};

const authenticateWithUserToken = async (
    req: AuthenticatedRequest,
    res: Response,
    token: string
): Promise<boolean> => {
    const startTime = Date.now();
    const tokenService = container.resolve<ITokenService>(AUTH_TOKENS.TokenService);
    const decoded = tokenService.verify(token);
    if (!decoded) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return false;
    }

    const userRepository = container.resolve<IUserRepository>(AUTH_TOKENS.UserRepository);
    const sessionRepository = container.resolve<ISessionRepository>(SESSION_TOKENS.SessionRepository);
    const user = await userRepository.findById(decoded.id);
    if (!user) {
        BaseResponse.error(res, ErrorCodes.USER_NOT_FOUND, 401, ErrorCodes.USER_NOT_FOUND);
        return false;
    }

    if (user.isPasswordChangedAfterTokenIssued(decoded.iat ?? 0)) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return false;
    }

    const session = await sessionRepository.findByToken(token);
    if (!session || !session.props.isActive) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return false;
    }

    req.authType = AuthenticationType.User;
    req.user = user;
    req.userId = user.id;
    req.token = token;

    const authContext: HttpRequestAuthContext = {
        authType: HttpRequestAuthType.User,
        subjectId: user.id,
        durationMs: Date.now() - startTime,
        cached: false
    };

    setRequestAuthContext(req, authContext);
    logger.info({
        traceId: req.requestContext?.traceId,
        authType: AuthenticationType.User,
        userId: user.id,
        durationMs: authContext.durationMs
    }, '@authentication');

    return true;
};

const authenticateFromToken = async (
    req: AuthenticatedRequest,
    res: Response,
    token: string
): Promise<boolean> => {
    if (token.startsWith('vsk_')) {
        return authenticateWithSecretKey(req, res, token);
    }

    return authenticateWithUserToken(req, res, token);
};

export const protect = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (isAuthenticatedRequest(req)) {
        const authContext: HttpRequestAuthContext = {
            authType: req.authType === AuthenticationType.SecretKey
                ? HttpRequestAuthType.SecretKey
                : HttpRequestAuthType.User,
            subjectId: req.authType === AuthenticationType.SecretKey
                ? req.secretKeyId || 'unknown'
                : req.userId || 'unknown',
            durationMs: 0,
            cached: true
        };

        setRequestAuthContext(req, authContext);
        logger.debug({
            traceId: req.requestContext?.traceId,
            authType: req.authType,
            cached: true
        }, '@authentication');
        next();
        return;
    }

    const authenticationStartedAt = Date.now();
    const token = getBearerToken(req);

    if (!token) {
        logger.warn({
            traceId: req.requestContext?.traceId,
            durationMs: Date.now() - authenticationStartedAt
        }, '@authentication: missing bearer token');
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_REQUIRED, 401, ErrorCodes.AUTHENTICATION_REQUIRED);
        return;
    }

    const isAuthenticated = await authenticateFromToken(req, res, token);
    if (!isAuthenticated) {
        logger.warn({
            traceId: req.requestContext?.traceId,
            durationMs: Date.now() - authenticationStartedAt
        }, '@authentication: rejected');
        return;
    }

    next();
};

/**
 * Authenticates the request when a bearer token is present, but allows guests when omitted.
 */
export const authenticateOptional = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (isAuthenticatedRequest(req)) {
        const authContext: HttpRequestAuthContext = {
            authType: req.authType === AuthenticationType.SecretKey
                ? HttpRequestAuthType.SecretKey
                : HttpRequestAuthType.User,
            subjectId: req.authType === AuthenticationType.SecretKey
                ? req.secretKeyId || 'unknown'
                : req.userId || 'unknown',
            durationMs: 0,
            cached: true
        };

        setRequestAuthContext(req, authContext);
        next();
        return;
    }

    const token = getBearerToken(req);

    if (!token) {
        next();
        return;
    }

    const isAuthenticated = await authenticateFromToken(req, res, token);
    if (!isAuthenticated) {
        return;
    }

    next();
};
