import { CheckEmailInputDTO, CheckEmailOutputDTO } from '@modules/auth/application/dtos/CheckEmailDTO';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { injectable } from 'tsyringe';

@injectable()
export default class CheckEmailUseCase implements IUseCase<CheckEmailInputDTO, CheckEmailOutputDTO, ApplicationError>{
    constructor(
        
        private readonly userRepository: UserRepository
    ) {}

    async execute(input: CheckEmailInputDTO): Promise<Result<CheckEmailOutputDTO, ApplicationError>>{
        const exists = await this.userRepository.emailExists(input.email);
        return Result.ok({ exists });
    }
};
