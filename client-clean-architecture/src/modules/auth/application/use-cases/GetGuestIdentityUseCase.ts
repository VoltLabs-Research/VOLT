import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class GetGuestIdentityUseCase implements IUseCase<GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository
    ){}

    execute(data: GetGuestIdentityInputDTO): Promise<GetGuestIdentityOutputDTO>{
        return this.authRepository.getGuestIdentity(data.seed);
    }
};