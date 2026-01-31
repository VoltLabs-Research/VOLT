import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import type {
    ChangePasswordUseCase,
    CheckEmailUseCase,
    GetGuestIdentityUseCase,
    GetMeUseCase,
    GetPasswordInfoUseCase,
    SignInUseCase,
    SignUpUseCase,
    UpdateMeUseCase
} from '@/modules/auth/application/use-cases';

const useAuthUseCases = createUseCasesHook({
    checkEmailUseCase: AUTH_TOKENS.CheckEmailUseCase,
    signInUseCase: AUTH_TOKENS.SignInUseCase,
    signUpUseCase: AUTH_TOKENS.SignUpUseCase,
    getMeUseCase: AUTH_TOKENS.GetMeUseCase,
    getGuestIdentityUseCase: AUTH_TOKENS.GetGuestIdentityUseCase,
    updateMeUseCase: AUTH_TOKENS.UpdateMeUseCase,
    getPasswordInfoUseCase: AUTH_TOKENS.GetPasswordInfoUseCase,
    changePasswordUseCase: AUTH_TOKENS.ChangePasswordUseCase
}) as () => {
    checkEmailUseCase: CheckEmailUseCase;
    signInUseCase: SignInUseCase;
    signUpUseCase: SignUpUseCase;
    getMeUseCase: GetMeUseCase;
    getGuestIdentityUseCase: GetGuestIdentityUseCase;
    updateMeUseCase: UpdateMeUseCase;
    getPasswordInfoUseCase: GetPasswordInfoUseCase;
    changePasswordUseCase: ChangePasswordUseCase;
};

export default useAuthUseCases;
