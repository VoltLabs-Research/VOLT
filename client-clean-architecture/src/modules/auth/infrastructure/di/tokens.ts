export const AUTH_TOKENS = {
    AuthRepository: Symbol('AuthRepository'),
    TokenStorage: Symbol('TokenStorage'),
    CheckEmailUseCase: Symbol('CheckEmailUseCase'),
    SignInUseCase: Symbol('SignInUseCase'),
    SignUpUseCase: Symbol('SignUpUseCase'),
    GetMeUseCase: Symbol('GetMeUseCase'),
    GetGuestIdentityUseCase: Symbol('GetGuestIdentityUseCase'),
    UpdateMeUseCase: Symbol('UpdateMeUseCase'),
    GetPasswordInfoUseCase: Symbol('GetPasswordInfoUseCase'),
    ChangePasswordUseCase: Symbol('ChangePasswordUseCase')
} as const;