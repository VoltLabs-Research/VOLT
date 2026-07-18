import { ErrorCodes } from '@core/constants/error-codes';
import { isPopulatedSecretKeyRole } from '@shared/contracts/types/SecretKey';
import SecretKeyModel, { getSecretKeyCreatedById, getSecretKeyRoleId } from '@modules/team/models/secret-key/SecretKeyModel';
import { logSecretKeyUsageRequest } from '@modules/team/services/secret-key/SecretKeyUsageAnalyticsQueries';
import {
    HttpRequestAuthType,
    setHttpRequestContextAuth,
    type HttpRequestAuthContext,
    type HttpRequestContext
} from '@shared/infrastructure/http/request-context';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import logger from '@shared/infrastructure/logger';
import crypto from 'node:crypto';

import UserModel from '@modules/auth/models/UserModel';
import JwtTokenService from '@modules/auth/services/JwtTokenService';
import SessionModel from '@modules/session/models/SessionModel';
import type { NextFunction, Request, Response } from 'express';

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
    const keyHash = crypto.createHash('sha256').update(token).digest('hex');
    const secretKey = await SecretKeyModel.findOne({
        keyHash,
        isActive: true
    }).populate({
        path: 'role',
        select: ['name', 'permissions']
    });

    if (!secretKey) {
        BaseResponse.error(res, ErrorCodes.SECRET_KEY_INVALID, 401, ErrorCodes.SECRET_KEY_INVALID);
        return false;
    }

    const role = isPopulatedSecretKeyRole(secretKey.role)
        ? secretKey.role
        : undefined;
    const createdById = getSecretKeyCreatedById(secretKey);
    const secretKeyId = String(secretKey._id);

    req.authType = AuthenticationType.SecretKey;
    req.token = token;
    req.secretKeyId = secretKeyId;
    req.secretKeyTeamId = String(secretKey.team);
    req.secretKeyRoleId = role?._id?.toString?.() || getSecretKeyRoleId(secretKey);
    req.teamPermissions = Array.isArray(role?.permissions)
        ? role.permissions
        : [];
    req.userId = createdById;

    await SecretKeyModel.updateOne({ _id: secretKeyId }, { lastUsedAt: new Date() });

    const authContext: HttpRequestAuthContext = {
        authType: HttpRequestAuthType.SecretKey,
        subjectId: secretKeyId,
        durationMs: Date.now() - startTime,
        cached: false
    };

    setRequestAuthContext(req, authContext);
    logger.info(`@authentication traceId=${req.requestContext?.traceId} authType=${AuthenticationType.SecretKey} secretKeyId=${secretKeyId} teamId=${req.secretKeyTeamId}`);

    res.on('finish', () => {
        const userAgentHeader = req.headers['user-agent'];
        logSecretKeyUsageRequest({
            secretKey: secretKeyId,
            team: String(secretKey.team),
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
    const tokenService = new JwtTokenService();
    const decoded = tokenService.verify(token);
    if (!decoded) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return false;
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
        BaseResponse.error(res, ErrorCodes.USER_NOT_FOUND, 401, ErrorCodes.USER_NOT_FOUND);
        return false;
    }

    if (user.isPasswordChangedAfterTokenIssued(decoded.iat ?? 0)) {
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_UNAUTHORIZED, 401, ErrorCodes.AUTHENTICATION_UNAUTHORIZED);
        return false;
    }

    const session = await SessionModel.findOne({ token, isActive: true });
    if (!session) {
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
    logger.info(`@authentication traceId=${req.requestContext?.traceId} authType=${AuthenticationType.User} userId=${user.id} durationMs=${authContext.durationMs}`);

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
        logger.debug(`@authentication traceId=${req.requestContext?.traceId} authType=${req.authType} cached=${true}`);
        next();
        return;
    }

    const authenticationStartedAt = Date.now();
    const token = getBearerToken(req);

    if (!token) {
        logger.warn(`@authentication: missing bearer token traceId=${req.requestContext?.traceId} durationMs=${Date.now() - authenticationStartedAt}`);
        BaseResponse.error(res, ErrorCodes.AUTHENTICATION_REQUIRED, 401, ErrorCodes.AUTHENTICATION_REQUIRED);
        return;
    }

    const isAuthenticated = await authenticateFromToken(req, res, token);
    if (!isAuthenticated) {
        logger.warn(`@authentication: rejected traceId=${req.requestContext?.traceId} durationMs=${Date.now() - authenticationStartedAt}`);
        return;
    }

    next();
};

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
