import { useMemo } from 'react';
import { container } from 'tsyringe';
import {
    ChangePasswordUseCase,
    CheckEmailUseCase,
    GetGuestIdentityUseCase,
    GetMeUseCase,
    GetPasswordInfoUseCase,
    SignInUseCase,
    SignUpUseCase,
    UpdateMeUseCase
} from '@/modules/auth/application/use-cases';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

const useAuthUseCases = () => {
    const checkEmailUseCase = useMemo(() => {
        return container.resolve<CheckEmailUseCase>(AUTH_TOKENS.CheckEmailUseCase);
    }, []);

    const signInUseCase = useMemo(() => {
        return container.resolve<SignInUseCase>(AUTH_TOKENS.SignInUseCase);
    }, []);

    const signUpUseCase = useMemo(() => {
        return container.resolve<SignUpUseCase>(AUTH_TOKENS.SignUpUseCase);
    }, []);

    const getMeUseCase = useMemo(() => {
        return container.resolve<GetMeUseCase>(AUTH_TOKENS.GetMeUseCase);
    }, []);

    const getGuestIdentityUseCase = useMemo(() => {
        return container.resolve<GetGuestIdentityUseCase>(AUTH_TOKENS.GetGuestIdentityUseCase);
    }, []);

    const updateMeUseCase = useMemo(() => {
        return container.resolve<UpdateMeUseCase>(AUTH_TOKENS.UpdateMeUseCase);
    }, []);

    const getPasswordInfoUseCase = useMemo(() => {
        return container.resolve<GetPasswordInfoUseCase>(AUTH_TOKENS.GetPasswordInfoUseCase);
    }, []);

    const changePasswordUseCase = useMemo(() => {
        return container.resolve<ChangePasswordUseCase>(AUTH_TOKENS.ChangePasswordUseCase);
    }, []);

    return {
        checkEmailUseCase,
        signInUseCase,
        signUpUseCase,
        getMeUseCase,
        getGuestIdentityUseCase,
        updateMeUseCase,
        getPasswordInfoUseCase,
        changePasswordUseCase
    };
};

export default useAuthUseCases;
