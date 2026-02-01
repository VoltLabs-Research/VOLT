import { useMemo } from 'react';
import { container } from 'tsyringe';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import type { SignInUseCase, SignUpUseCase } from '@/modules/auth/application/use-cases';
import type IAuthRepository from '@/modules/auth/domain/ports/IAuthRepository';

interface AuthUseCases{
    signInUseCase: SignInUseCase;
    signUpUseCase: SignUpUseCase;
    authRepository: IAuthRepository;
};

const useAuthUseCases = (): AuthUseCases => {
    return useMemo(() => ({
        signInUseCase: container.resolve<SignInUseCase>(AUTH_TOKENS.SignInUseCase),
        signUpUseCase: container.resolve<SignUpUseCase>(AUTH_TOKENS.SignUpUseCase),
        authRepository: container.resolve<IAuthRepository>(AUTH_TOKENS.AuthRepository)
    }), []);
};

export default useAuthUseCases;
