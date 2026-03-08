import { Response } from 'express';
import { injectable } from 'tsyringe';
import { ErrorCodes } from '@core/constants/error-codes';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

interface OAuthCallbackRequest extends AuthenticatedRequest {
    oauthErrorCode?: string;
    oauthErrorMessage?: string;
}

const appendQueryParameter = (url: string, key: string, value: string): string => {
    const hashIndex = url.indexOf('#');
    const baseUrl = hashIndex >= 0
        ? url.slice(0, hashIndex)
        : url;
    const hash = hashIndex >= 0
        ? url.slice(hashIndex)
        : '';
    const separator = baseUrl.includes('?')
        ? '&'
        : '?';

    return `${baseUrl}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}${hash}`;
};

@injectable()
export default class OAuthLoginCallbackController {
    constructor() {}

    async handle(req: AuthenticatedRequest, res: Response): Promise<void> {
        const request = req as OAuthCallbackRequest;

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
