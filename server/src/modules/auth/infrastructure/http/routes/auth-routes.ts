import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { createOAuthCallbackMiddleware, createOAuthLoginRoute } from '@modules/auth/infrastructure/http/oauth/route-helpers';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import avatarUpload from '@modules/auth/infrastructure/http/middlewares/avatar-upload';
import controllers from '@modules/auth/infrastructure/http/controllers';
import { Router } from 'express';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/auth',
    router
};

const authRateLimiter = createStandardRateLimiter(15);

const passwordRateLimiter = createStandardRateLimiter(5, 'Too many password attempts, please try again later');

router.post('/sessions', authRateLimiter, controllers.signIn.handle);
router.post('/users', authRateLimiter, controllers.signUp.handle);
router.get('/emails/:email/availability', authRateLimiter, controllers.checkEmail.handle);

router.get('/guest-identity', controllers.getGuestIdentity.handle);

router.get('/github', createOAuthLoginRoute(OAuthProvider.GitHub, ['user:email']));
router.get('/github/callback', createOAuthCallbackMiddleware(OAuthProvider.GitHub), controllers.oauthLoginCallback.handle);

router.get('/google', createOAuthLoginRoute(OAuthProvider.Google, ['profile', 'email']));
router.get('/google/callback', createOAuthCallbackMiddleware(OAuthProvider.Google), controllers.oauthLoginCallback.handle);

router.get('/microsoft', createOAuthLoginRoute(OAuthProvider.Microsoft, ['user.read']));
router.get('/microsoft/callback', createOAuthCallbackMiddleware(OAuthProvider.Microsoft), controllers.oauthLoginCallback.handle);

router.use(protect);
router.get('/password/info', controllers.getPasswordInfo.handle);
router.patch('/me/password', passwordRateLimiter, controllers.updatePassword.handle);

router.route('/me')
    .get(controllers.getMyAccount.handle)
    .patch(avatarUpload.single('avatar'), controllers.updateMyAccount.handle)
    .delete(controllers.deleteMyAccount.handle);

export default module;
