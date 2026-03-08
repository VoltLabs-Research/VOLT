import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { ErrorCodes } from '@core/constants/error-codes';

interface OAuthCallbackInfo {
    code?: string;
    message?: string;
}

interface OAuthCallbackRequest extends Request {
    token?: string;
    oauthErrorCode?: string;
    oauthErrorMessage?: string;
}

const CANONICAL_ERROR_CODES = new Set<string>(Object.values(ErrorCodes));

const getOAuthFailureCode = (value: unknown): string => {
    if (typeof value !== 'string') {
        return ErrorCodes.OAUTH_STRATEGY_ERROR;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue || !CANONICAL_ERROR_CODES.has(normalizedValue)) {
        return ErrorCodes.OAUTH_STRATEGY_ERROR;
    }

    return normalizedValue;
};

export const createOAuthLoginRoute = (provider: OAuthProvider, scope?: string[]) => {
    return passport.authenticate(provider, {
        session: false,
        ...(scope ? { scope } : {})
    });
};

export const createOAuthCallbackMiddleware = (provider: OAuthProvider) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        passport.authenticate(provider, { session: false }, (error: unknown, _user: unknown, info?: OAuthCallbackInfo) => {
            const authRequest = request as OAuthCallbackRequest;

            if (error) {
                authRequest.oauthErrorCode = ErrorCodes.OAUTH_STRATEGY_ERROR;
                authRequest.oauthErrorMessage = ErrorCodes.OAUTH_STRATEGY_ERROR;
                next();
                return;
            }

            if (!authRequest.token) {
                authRequest.oauthErrorCode = getOAuthFailureCode(info?.code);
                authRequest.oauthErrorMessage = getOAuthFailureCode(info?.message ?? authRequest.oauthErrorCode);
            }

            next();
        })(request, response, next);
    };
};
