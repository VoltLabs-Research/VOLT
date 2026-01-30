import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { SignUpInputDTO, SignUpOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITokenStorage from '../../domain/ports/ITokenStorage';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class SignUpUseCase implements IUseCase<SignUpInputDTO, SignUpOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository,
        @inject(AUTH_TOKENS.TokenStorage)
        private readonly tokenStorage: ITokenStorage
    ){}

    async execute(data: SignUpInputDTO): Promise<SignUpOutputDTO>{
        const result = await this.authRepository.signUp(data);
        this.tokenStorage.setToken(result.token);
        return result;
    }
};