import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { createOAuthCallbackMiddleware, createOAuthLoginRoute } from '@modules/auth/infrastructure/http/oauth/route-helpers';
import avatarUpload from '@modules/auth/infrastructure/http/middlewares/avatar-upload';
import controllers from '@modules/auth/infrastructure/http/controllers';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/auth',
    routes: (router) => {
        router.post('/sessions', RATE_LIMIT_POLICIES.authPublic, controllers.signIn.handle);
        router.post('/users', controllers.signUp.handle);
        router.get('/emails/:email/availability', controllers.checkEmail.handle);

        router.get('/guest-identity', controllers.getGuestIdentity.handle);
        router.get('/github', createOAuthLoginRoute(OAuthProvider.GitHub, ['user:email']));
        router.get('/github/callback', createOAuthCallbackMiddleware(OAuthProvider.GitHub), controllers.oauthLoginCallback.handle);
        router.get('/google', createOAuthLoginRoute(OAuthProvider.Google, ['profile', 'email']));
        router.get('/google/callback', createOAuthCallbackMiddleware(OAuthProvider.Google), controllers.oauthLoginCallback.handle);
        router.get('/microsoft', createOAuthLoginRoute(OAuthProvider.Microsoft, ['user.read']));
        router.get('/microsoft/callback', createOAuthCallbackMiddleware(OAuthProvider.Microsoft), controllers.oauthLoginCallback.handle);

        router.use(protect);
        router.get('/password/info', controllers.getPasswordInfo.handle);
        router.patch('/me/password', RATE_LIMIT_POLICIES.passwordUpdate, controllers.updatePassword.handle);

        router.route('/me')
            .get(controllers.getMyAccount.handle)
            .patch(avatarUpload.single('avatar'), controllers.updateMyAccount.handle)
            .delete(controllers.deleteMyAccount.handle);
    }
});
