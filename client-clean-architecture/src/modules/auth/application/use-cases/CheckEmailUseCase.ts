import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class CheckEmailUseCase implements IUseCase<CheckEmailInputDTO, CheckEmailOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository
    ){}

    execute(data: CheckEmailInputDTO): Promise<CheckEmailOutputDTO>{
        return this.authRepository.checkEmail(data.email);
    }
};