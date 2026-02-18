import { createUseCasesHook } from '@/shared/presentation/hooks/create-use-cases-hook';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';
import type { SignInUseCase, SignUpUseCase } from '@/modules/auth/application/use-cases';
import type IAuthRepository from '@/modules/auth/domain/ports/IAuthRepository';

const useAuthUseCases = createUseCasesHook({
    signInUseCase: AUTH_TOKENS.SignInUseCase,
    signUpUseCase: AUTH_TOKENS.SignUpUseCase,
    authRepository: AUTH_TOKENS.AuthRepository
}) as () => {
    signInUseCase: SignInUseCase;
    signUpUseCase: SignUpUseCase;
    authRepository: IAuthRepository;
};

export default useAuthUseCases;
