import AuthController from '@modules/auth/infrastructure/http/controllers/AuthController';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { createOAuthCallbackMiddleware, createOAuthLoginRoute } from '@modules/auth/infrastructure/http/oauth/route-helpers';
import avatarUpload from '@modules/auth/infrastructure/http/middlewares/avatar-upload';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';
import { container } from 'tsyringe';

const controller = container.resolve(AuthController);

export default createHttpModule({
    moduleKey: 'auth',
    basePath: '/api/auth',
    routes: (router) => {
        router.post('/sessions', RATE_LIMIT_POLICIES.authPublic, controller.signIn);
        // Local single-tenant desktop: credential-less auto-login for the canonical
        // local user. The service no-ops (404) unless DEPLOYMENT_MODE=local.
        router.post('/sessions/local', RATE_LIMIT_POLICIES.authPublic, controller.localSignIn);
        router.post('/users', controller.signUp);
        router.get('/emails/:email/availability', controller.checkEmail);

        router.get('/oauth/providers', controller.getOAuthProviders);

        router.get('/guest-identity', controller.getGuestIdentity);
        router.get('/github', createOAuthLoginRoute(OAuthProvider.GitHub, ['user:email']));
        router.get('/github/callback', createOAuthCallbackMiddleware(OAuthProvider.GitHub), controller.oauthLoginCallback);
        router.get('/google', createOAuthLoginRoute(OAuthProvider.Google, ['profile', 'email']));
        router.get('/google/callback', createOAuthCallbackMiddleware(OAuthProvider.Google), controller.oauthLoginCallback);
        router.get('/microsoft', createOAuthLoginRoute(OAuthProvider.Microsoft, ['user.read']));
        router.get('/microsoft/callback', createOAuthCallbackMiddleware(OAuthProvider.Microsoft), controller.oauthLoginCallback);

        router.use(protect);
        router.get('/password/info', controller.getPasswordInfo);
        router.patch('/me/password', RATE_LIMIT_POLICIES.passwordUpdate, controller.updatePassword);

        router.route('/me')
            .get(controller.getMyAccount)
            .patch(avatarUpload.single('avatar'), controller.updateMyAccount)
            .delete(controller.deleteMyAccount);
    }
});
