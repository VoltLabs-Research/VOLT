import { CheckEmailInputDTO, CheckEmailOutputDTO } from '@modules/auth/application/dtos/CheckEmailDTO';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class CheckEmailUseCase implements IUseCase<CheckEmailInputDTO, CheckEmailOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ) {}

    async execute(input: CheckEmailInputDTO): Promise<Result<CheckEmailOutputDTO, ApplicationError>>{
        const exists = await this.userRepository.emailExists(input.email);
        return Result.ok({ exists });
    }
};
