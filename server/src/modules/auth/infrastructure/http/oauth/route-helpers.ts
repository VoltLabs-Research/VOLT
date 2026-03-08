import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { ErrorCodes } from '@core/constants/error-codes';
import passport from 'passport';
import type { NextFunction, Request, Response } from 'express';

declare global {
    namespace Express {
        interface Request {
            token?: string;
            oauthErrorCode?: string;
            oauthErrorMessage?: string;
        }
    }
}

interface OAuthCallbackInfo {
    code?: string;
    message?: string;
}

interface OAuthRouteOptions {
    session: false;
    scope?: string[];
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
    const options: OAuthRouteOptions = {
        session: false
    };

    if (scope) {
        options.scope = scope;
    }

    return passport.authenticate(provider, options);
};

export const createOAuthCallbackMiddleware = (provider: OAuthProvider) => {
    return (request: Request, response: Response, next: NextFunction): void => {
        passport.authenticate(provider, {
            session: false
        }, (error: unknown, _user: unknown, info?: OAuthCallbackInfo) => {
            if (error) {
                request.oauthErrorCode = ErrorCodes.OAUTH_STRATEGY_ERROR;
                request.oauthErrorMessage = ErrorCodes.OAUTH_STRATEGY_ERROR;
                next();
                return;
            }

            if (!request.token) {
                request.oauthErrorCode = getOAuthFailureCode(info?.code);
                request.oauthErrorMessage = getOAuthFailureCode(info?.message ?? request.oauthErrorCode);
            }

            next();
        })(request, response, next);
    };
};
