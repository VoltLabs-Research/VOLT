import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { ChangePasswordInputDTO, ChangePasswordOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class ChangePasswordUseCase implements IUseCase<ChangePasswordInputDTO, ChangePasswordOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository
    ){}

    execute(data: ChangePasswordInputDTO): Promise<ChangePasswordOutputDTO>{
        return this.authRepository.changePassword(data);
    }
};