import type {
    IAuthRepository,
    ITokenStorage,
    IErrorHistoryRepository,
    ISessionRepository
} from '../domain/repositories';
import {
    ChangePasswordUseCase,
    CheckEmailUseCase,
    GetMeUseCase,
    GetPasswordInfoUseCase,
    SetAuthTokenUseCase,
    SignInUseCase,
    SignOutUseCase,
    SignUpUseCase,
    UpdateMeUseCase
} from './use-cases';

export interface AuthDependencies {
    authRepository: IAuthRepository;
    tokenStorage: ITokenStorage;
    errorHistoryRepository: IErrorHistoryRepository;
    sessionRepository: ISessionRepository;
}

export interface AuthUseCases {
    getMeUseCase: GetMeUseCase;
    signInUseCase: SignInUseCase;
    signUpUseCase: SignUpUseCase;
    signOutUseCase: SignOutUseCase;
    changePasswordUseCase: ChangePasswordUseCase;
    getPasswordInfoUseCase: GetPasswordInfoUseCase;
    checkEmailUseCase: CheckEmailUseCase;
    updateMeUseCase: UpdateMeUseCase;
    setAuthTokenUseCase: SetAuthTokenUseCase;
}

let dependencies: AuthDependencies | null = null;
let useCases: AuthUseCases | null = null;

const buildUseCases = (deps: AuthDependencies): AuthUseCases => ({
    getMeUseCase: new GetMeUseCase(deps.authRepository, deps.tokenStorage),
    signInUseCase: new SignInUseCase(deps.authRepository, deps.tokenStorage),
    signUpUseCase: new SignUpUseCase(deps.authRepository, deps.tokenStorage),
    signOutUseCase: new SignOutUseCase(deps.tokenStorage, deps.errorHistoryRepository),
    changePasswordUseCase: new ChangePasswordUseCase(deps.authRepository),
    getPasswordInfoUseCase: new GetPasswordInfoUseCase(deps.authRepository),
    checkEmailUseCase: new CheckEmailUseCase(deps.authRepository),
    updateMeUseCase: new UpdateMeUseCase(deps.authRepository),
    setAuthTokenUseCase: new SetAuthTokenUseCase(deps.tokenStorage)
});

export const registerAuthDependencies = (deps: AuthDependencies): void => {
    dependencies = deps;
    useCases = null;
};

export const getAuthUseCases = (): AuthUseCases => {
    if (!dependencies) {
        throw new Error('Auth dependencies not registered');
    }

    if (!useCases) {
        useCases = buildUseCases(dependencies);
    }

    return useCases;
};