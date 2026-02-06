import { Router } from 'express';
import { container } from 'tsyringe';
import avatarUpload from '@modules/auth/infrastructure/http/middlewares/avatar-upload';
import CheckEmailController from '@modules/auth/infrastructure/http/controllers/CheckEmailController';
import DeleteMyAccountController from '@modules/auth/infrastructure/http/controllers/DeleteMyAccountController';
import GetGuestIdentityController from '@modules/auth/infrastructure/http/controllers/GetGuestIdentityController';
import GetMyAccountController from '@modules/auth/infrastructure/http/controllers/GetMyAccountController';
import OAuthLoginCallbackController from '@modules/auth/infrastructure/http/controllers/OAuthLoginCallbackController';
import SignInController from '@modules/auth/infrastructure/http/controllers/SignInController';
import SignUpController from '@modules/auth/infrastructure/http/controllers/SignUpController';
import UpdateMyAccountController from '@modules/auth/infrastructure/http/controllers/UpdateMyAccountController';
import UpdatePasswordController from '@modules/auth/infrastructure/http/controllers/UpdatePasswordController';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import passport from 'passport';
import { OAuthProvider } from '@modules/auth/domain/entities/User';
import { HttpModule } from '@shared/infrastructure/http/HttpModule';

const checkEmailController = container.resolve(CheckEmailController);
const deleteMyAccountController = container.resolve(DeleteMyAccountController);
const getGuestIdentityController = container.resolve(GetGuestIdentityController);
const getMyAccountController = container.resolve(GetMyAccountController);
const oauthLoginCallbackController = container.resolve(OAuthLoginCallbackController);
const signInController = container.resolve(SignInController);
const signUpController = container.resolve(SignUpController);
const updateMyAccountController = container.resolve(UpdateMyAccountController);
const updatePasswordController = container.resolve(UpdatePasswordController);

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/auth',
    router
};

router.post('/sign-in', signInController.handle);
router.post('/sign-up', signUpController.handle);
router.post('/check-email', checkEmailController.handle);

router.get('/guest-identity', getGuestIdentityController.handle);

// OAuth
router.get('/github', passport.authenticate(OAuthProvider.GitHub, { session: false, scope: ['user:email'] }));
router.get(
    '/github/callback',
    passport.authenticate(OAuthProvider.GitHub, { session: false, failureRedirect: '/auth/error' }),
    oauthLoginCallbackController.handle
);

router.get('/google', passport.authenticate(OAuthProvider.Google, { session: false, scope: ['profile', 'email'] }));
router.get(
    '/google/callback',
    passport.authenticate(OAuthProvider.Google, { session: false, failureRedirect: '/auth/error' }),
    oauthLoginCallbackController.handle
);

router.get('/microsoft', passport.authenticate(OAuthProvider.Microsoft, { session: false, scope: ['user.read'] }));
router.get(
    '/microsoft/callback',
    passport.authenticate(OAuthProvider.Microsoft, { session: false, failureRedirect: '/auth/error' }),
    oauthLoginCallbackController.handle
);

router.use(protect);
router.patch('/me/update/password/', updatePasswordController.handle);

router.route('/me')
    .get(getMyAccountController.handle)
    .patch(avatarUpload.single('avatar'), updateMyAccountController.handle)
    .delete(deleteMyAccountController.handle);

export default module;