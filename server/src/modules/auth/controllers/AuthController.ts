import { ErrorCodes } from '@core/constants/error-codes';
import Controller, { Middleware } from '@shared/http/Controller';
import { Route, Status } from '@shared/http/route';
import { Body, Param, Query, CurrentUser, Ip, UserAgent, Req } from '@shared/http/params';
import { protect } from '@modules/auth/controllers/middleware/authentication';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import AuthService from '@modules/auth/services/AuthService';
import { OAuthProvider } from '@modules/auth/contracts/domain/user';
import { createOAuthCallbackMiddleware, createOAuthLoginRoute } from '@modules/auth/controllers/oauth-route-helpers';
import { authRoutes } from '@volt/contracts/modules/auth/routes';
import type {
    SignInInput,
    SignUpInput,
    UpdatePasswordInput,
    UpdateAccountInput
} from '@volt/contracts/modules/auth/http';
import type { AuthenticatedRequest } from '@shared/contracts/types/AuthenticatedRequest';
import multer from 'multer';
import type { RequestHandler, Response, Router } from 'express';

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
});

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

export default class AuthController extends Controller {
    #service = new AuthService();

    @Route(authRoutes.signIn)
    @Middleware(RATE_LIMIT_POLICIES.authPublic)
    @Status(200)
    signIn(
        @Body() body: SignInInput,
        @Ip() ip: string,
        @UserAgent() userAgent: string
    ){
        return this.#service.signIn(body, {
            ip,
            userAgent
        });
    }

    @Route(authRoutes.localSignIn)
    @Middleware(RATE_LIMIT_POLICIES.authPublic)
    @Status(200)
    localSignIn(
        @Ip() ip: string,
        @UserAgent() userAgent: string
    ){
        return this.#service.localSignIn({
            ip,
            userAgent
        });
    }

    @Route(authRoutes.signUp)
    @Status(201)
    signUp(
        @Body() body: SignUpInput,
        @Ip() ip: string,
        @UserAgent() userAgent: string
    ){
        return this.#service.signUp(body, {
            ip,
            userAgent
        });
    }

    @Route(authRoutes.checkEmail)
    checkEmail(@Param('email') email: string) {
        return this.#service.checkEmail(email);
    }

    @Route(authRoutes.oauthProviders)
    getOAuthProviders() {
        return this.#service.getOAuthProviders();
    }

    @Route(authRoutes.guestIdentity)
    getGuestIdentity(@Query('seed') seed: string) {
        return this.#service.getGuestIdentity(seed);
    }

    @Route(authRoutes.passwordInfo)
    @Middleware(protect)
    getPasswordInfo(@CurrentUser() userId: string) {
        return this.#service.getPasswordInfo(userId);
    }

    @Route(authRoutes.updatePassword)
    @Middleware(protect, RATE_LIMIT_POLICIES.passwordUpdate)
    @Status(200)
    updatePassword(
        @CurrentUser() userId: string,
        @Body() body: UpdatePasswordInput,
        @Ip() ip: string,
        @UserAgent() userAgent: string
    ) {
        return this.#service.updatePassword(userId, body, {
            ip,
            userAgent
        });
    }

    @Route(authRoutes.getMyAccount)
    @Middleware(protect)
    getMyAccount(@CurrentUser() userId: string) {
        return this.#service.getMyAccount(userId);
    }

    @Route(authRoutes.updateMyAccount)
    @Middleware(protect, avatarUpload.single('avatar'))
    @Status(200)
    updateMyAccount(
        @CurrentUser() userId: string,
        @Body() body: UpdateAccountInput,
        @Req() req: AuthenticatedRequest
    ){
        return this.#service.updateAccount(userId, body, req.file);
    }

    @Route(authRoutes.deleteMyAccount)
    @Middleware(protect)
    @Status(204)
    async deleteMyAccount(@CurrentUser() userId: string): Promise<void> {
        await this.#service.deleteAccount(userId);
    }

    #oauthLoginCallback: RequestHandler = (req: AuthenticatedRequest, res: Response): void => {
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

    override buildRouter(): Router {
        const router = super.buildRouter();

        router.get('/api/auth/github', createOAuthLoginRoute(OAuthProvider.GitHub, ['user:email']));
        router.get('/api/auth/github/callback', createOAuthCallbackMiddleware(OAuthProvider.GitHub), this.#oauthLoginCallback);
        router.get('/api/auth/google', createOAuthLoginRoute(OAuthProvider.Google, ['profile', 'email']));
        router.get('/api/auth/google/callback', createOAuthCallbackMiddleware(OAuthProvider.Google), this.#oauthLoginCallback);
        router.get('/api/auth/microsoft', createOAuthLoginRoute(OAuthProvider.Microsoft, ['user.read']));
        router.get('/api/auth/microsoft/callback', createOAuthCallbackMiddleware(OAuthProvider.Microsoft), this.#oauthLoginCallback);

        return router;
    }
}
