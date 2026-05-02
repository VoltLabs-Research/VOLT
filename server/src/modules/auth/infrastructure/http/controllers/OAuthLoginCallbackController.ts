import { ErrorCodes } from '@core/constants/error-codes';
import { injectable } from 'tsyringe';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

const appendQueryParameter = (url: string, key: string, value: string): string => {
    const hashIndex = url.indexOf('#');
    let baseUrl = url;
    if (hashIndex >= 0) {
        baseUrl = url.slice(0, hashIndex);
    }

    let hash = '';
    if (hashIndex >= 0) {
        hash = url.slice(hashIndex);
    }

    let separator = '?';
    if (baseUrl.includes('?')) {
        separator = '&';
    }

    return `${baseUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
};

@injectable()
export default class OAuthLoginCallbackController {
    constructor() {}

    async handle(request: AuthenticatedRequest, res: Response): Promise<void> {
        if (!request.token) {
            const errorCode = request.oauthErrorCode || ErrorCodes.OAUTH_STRATEGY_ERROR;
            const errorMessage = request.oauthErrorMessage || errorCode;
            const frontendUrl = process.env.OAUTH_FAILURE_REDIRECT || 'http://localhost:3000/auth/sign-in';

            res.redirect(
                appendQueryParameter(
                    appendQueryParameter(
                        appendQueryParameter(frontendUrl, 'error', errorCode),
                        'code',
                        errorCode
                    ),
                    'message',
                    errorMessage
                )
            );
            return;
        }

        const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/auth/oauth/success';
        res.redirect(appendQueryParameter(frontendUrl, 'token', request.token));
    }
}
