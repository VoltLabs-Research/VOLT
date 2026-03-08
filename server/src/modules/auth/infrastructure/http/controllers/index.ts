import { container } from 'tsyringe';
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

export default {
    checkEmail: container.resolve(CheckEmailController),
    deleteMyAccount: container.resolve(DeleteMyAccountController),
    getGuestIdentity: container.resolve(GetGuestIdentityController),
    getMyAccount: container.resolve(GetMyAccountController),
    getPasswordInfo: container.resolve(GetPasswordInfoController),
    oauthLoginCallback: container.resolve(OAuthLoginCallbackController),
    signIn: container.resolve(SignInController),
    signUp: container.resolve(SignUpController),
    updateMyAccount: container.resolve(UpdateMyAccountController),
    updatePassword: container.resolve(UpdatePasswordController)
};
