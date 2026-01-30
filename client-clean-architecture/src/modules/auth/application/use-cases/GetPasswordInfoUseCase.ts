import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { GetPasswordInfoOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class GetPasswordInfoUseCase implements IUseCase<void, GetPasswordInfoOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository
    ){}

    execute(): Promise<GetPasswordInfoOutputDTO>{
        return this.authRepository.getPasswordInfo();
    }
};