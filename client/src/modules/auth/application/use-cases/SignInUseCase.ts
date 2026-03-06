import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/port/IAuthRepository';
import type { SignInInputDTO, SignInOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITokenStorage from '../../domain/port/ITokenStorage';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class SignInUseCase implements IUseCase<SignInInputDTO, SignInOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository,
        @inject(AUTH_TOKENS.TokenStorage)
        private readonly tokenStorage: ITokenStorage
    ){}

    async execute(data: SignInInputDTO): Promise<SignInOutputDTO>{
        const result = await this.authRepository.signIn(data);
        this.tokenStorage.setToken(result.token);
        return result;
    }
};