import useResolve from '@/shared/presentation/hooks/use-resolve';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import type { SignInUseCase, SignUpUseCase } from '@/modules/auth/application/use-cases';
import type IAuthRepository from '@/modules/auth/domain/port/IAuthRepository';
import type TokenStorage from '@/modules/auth/infrastructure/storage/TokenStorage';

const useAuthUseCases = () => {
    return {
        signInUseCase: useResolve<SignInUseCase>(AUTH_TOKENS.SignInUseCase),
        signUpUseCase: useResolve<SignUpUseCase>(AUTH_TOKENS.SignUpUseCase),
        authRepository: useResolve<IAuthRepository>(AUTH_TOKENS.AuthRepository),
        tokenStorage: useResolve<TokenStorage>(AUTH_TOKENS.TokenStorage)
    };
};

export default useAuthUseCases;
