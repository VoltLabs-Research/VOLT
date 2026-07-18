import { ErrorCodes } from '@core/constants/error-codes';
import type AuthService from '@modules/auth/services/AuthService';
import type { CheckEmailInputDTO } from '@modules/auth/dtos/CheckEmailDTO';
import type { DeleteAccountInputDTO } from '@modules/auth/dtos/DeleteAccountDTO';
import type { GetGuestIdentityInputDTO } from '@modules/auth/dtos/GetGuestIdentityDTO';
import type { GetMyAccountInputDTO } from '@modules/auth/dtos/GetMyAccountDTO';
import type { GetPasswordInfoInputDTO } from '@modules/auth/dtos/GetPasswordInfoDTO';
import type { SignInInputDTO } from '@modules/auth/dtos/SignInDTO';
import type { SignUpInputDTO } from '@modules/auth/dtos/SignUpDTO';
import type { UpdateAccountInputDTO } from '@modules/auth/dtos/UpdateAccountDTO';
import type { UpdatePasswordInputDTO } from '@modules/auth/dtos/UpdatePasswordDTO';
import type { LocalSignInInput } from '@modules/auth/services/AuthService';
import { AUTH_TOKENS } from '@modules/auth/di/AuthTokens';
import { buildControllerParams } from '@shared/infrastructure/http/controllers/controller-internals';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import BaseResponse from '@shared/infrastructure/http/responses/BaseResponse';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { inject, injectable } from 'tsyringe';
import type { Response } from 'express';

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

/**
 * The single HTTP controller for the auth module. One Express handler per route,
 * assembling the use-case input exactly as `buildControllerParams` did for the
 * generated controllers, delegating to {@link AuthService}, and responding via
 * {@link BaseResponse}. Handlers are arrow-function properties so `this` stays
 * bound when passed by reference to the router. Thrown `ApplicationError`s
 * propagate to `httpErrorMiddleware` via Express 5 async forwarding.
 */
@injectable()
export default class AuthController {
    constructor(
        @inject(AUTH_TOKENS.AuthService) private readonly authService: AuthService
    ) {}

    signIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SignInInputDTO;
        const value = await this.authService.signIn(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    localSignIn = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as LocalSignInInput;
        const value = await this.authService.localSignIn(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    signUp = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as SignUpInputDTO;
        const value = await this.authService.signUp(input);
        BaseResponse.success(res, value, HttpStatus.Created);
    };

    checkEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as CheckEmailInputDTO;
        const value = await this.authService.checkEmail(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getMyAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetMyAccountInputDTO;
        const value = await this.authService.getMyAccount(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getPasswordInfo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetPasswordInfoInputDTO;
        const value = await this.authService.getPasswordInfo(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    getGuestIdentity = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as GetGuestIdentityInputDTO;
        const value = await this.authService.getGuestIdentity(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updatePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdatePasswordInputDTO;
        const value = await this.authService.updatePassword(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    deleteMyAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as DeleteAccountInputDTO;
        await this.authService.deleteAccount(input);
        // Preserves the generated controller's NoContent behaviour: empty body.
        res.status(HttpStatus.NoContent).send();
    };

    getOAuthProviders = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
        const value = this.authService.getOAuthProviders();
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    updateMyAccount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const input = buildControllerParams(req) as unknown as UpdateAccountInputDTO;
        const value = await this.authService.updateAccount(input);
        BaseResponse.success(res, value, HttpStatus.OK);
    };

    oauthLoginCallback = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        if (!req.token) {
            const errorCode = req.oauthErrorCode || ErrorCodes.OAUTH_STRATEGY_ERROR;
            const errorMessage = req.oauthErrorMessage || errorCode;
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
        res.redirect(appendQueryParameter(frontendUrl, 'token', req.token));
    };
}
