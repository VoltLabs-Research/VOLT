import { container } from 'tsyringe';
import AuthRepository from '@/modules/auth/infrastructure/repositories/AuthRepository';
import type IAuthRepository from '@/modules/auth/domain/ports/IAuthRepository';
import type ITokenStorage from '@/modules/auth/domain/ports/ITokenStorage';
import TokenStorage from '@/modules/auth/infrastructure/storage/TokenStorage';
import {
    CheckEmailUseCase,
    ChangePasswordUseCase,
    GetGuestIdentityUseCase,
    GetMeUseCase,
    GetPasswordInfoUseCase,
    SignInUseCase,
    SignUpUseCase,
    UpdateMeUseCase
} from '@/modules/auth/application/use-cases';
import { AUTH_TOKENS } from './tokens';

export const ensureAuthDI = () => {
    container.register<IAuthRepository>(AUTH_TOKENS.AuthRepository, AuthRepository);
    container.register<ITokenStorage>(AUTH_TOKENS.TokenStorage, TokenStorage);
    container.register(AUTH_TOKENS.CheckEmailUseCase, CheckEmailUseCase);
    container.register(AUTH_TOKENS.SignInUseCase, SignInUseCase);
    container.register(AUTH_TOKENS.SignUpUseCase, SignUpUseCase);
    container.register(AUTH_TOKENS.GetMeUseCase, GetMeUseCase);
    container.register(AUTH_TOKENS.GetGuestIdentityUseCase, GetGuestIdentityUseCase);
    container.register(AUTH_TOKENS.UpdateMeUseCase, UpdateMeUseCase);
    container.register(AUTH_TOKENS.GetPasswordInfoUseCase, GetPasswordInfoUseCase);
    container.register(AUTH_TOKENS.ChangePasswordUseCase, ChangePasswordUseCase);
};