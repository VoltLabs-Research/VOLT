import CheckEmailController from '@modules/auth/infrastructure/http/controllers/CheckEmailController';
import DeleteMyAccountController from '@modules/auth/infrastructure/http/controllers/DeleteMyAccountController';
import GetGuestIdentityController from '@modules/auth/infrastructure/http/controllers/GetGuestIdentityController';
import GetMyAccountController from '@modules/auth/infrastructure/http/controllers/GetMyAccountController';
import GetPasswordInfoController from '@modules/auth/infrastructure/http/controllers/GetPasswordInfoController';
import OAuthLoginCallbackController from '@modules/auth/infrastructure/http/controllers/OAuthLoginCallbackController';
import SignInController from '@modules/auth/infrastructure/http/controllers/SignInController';
import SignUpController from '@modules/auth/infrastructure/http/controllers/SignUpController';
import UpdateMyAccountController from '@modules/auth/infrastructure/http/controllers/UpdateMyAccountController';
import UpdatePasswordController from '@modules/auth/infrastructure/http/controllers/UpdatePasswordController';
import { createControllerRegistry } from '@shared/infrastructure/di/create-controller-registry';

export default createControllerRegistry({
    checkEmail: CheckEmailController,
    deleteMyAccount: DeleteMyAccountController,
    getGuestIdentity: GetGuestIdentityController,
    getMyAccount: GetMyAccountController,
    getPasswordInfo: GetPasswordInfoController,
    oauthLoginCallback: OAuthLoginCallbackController,
    signIn: SignInController,
    signUp: SignUpController,
    updateMyAccount: UpdateMyAccountController,
    updatePassword: UpdatePasswordController
});