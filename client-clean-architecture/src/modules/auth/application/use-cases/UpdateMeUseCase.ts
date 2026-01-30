import { inject, injectable } from 'tsyringe';
import type IAuthRepository from '../../domain/ports/IAuthRepository';
import type { UpdateMeInputDTO, UpdateMeOutputDTO } from '../dtos/index.ts';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import { AUTH_TOKENS } from '@/modules/auth/infrastructure/di/tokens';

@injectable()
export default class UpdateMeUseCase implements IUseCase<UpdateMeInputDTO, UpdateMeOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.AuthRepository)
        private readonly authRepository: IAuthRepository
    ){}
    
    execute(data: UpdateMeInputDTO): Promise<UpdateMeOutputDTO>{
        return this.authRepository.updateMe(data.data);
    }
};