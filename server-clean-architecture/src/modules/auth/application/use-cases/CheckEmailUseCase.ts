import { IUseCase } from '../../../../shared/application/IUseCase';
import { Result } from '../../../../shared/domain/Result';
import { CheckEmailInputDTO, CheckEmailOutputDTO } from '../dtos/CheckEmailDTO';
import { IUserRepository } from '../../domain/ports/IUserRepository';
import { injectable, inject } from 'tsyringe';
import ApplicationError from '../../../../shared/application/errors/ApplicationErrors';
import { AUTH_TOKENS } from '../../infrastructure/di/AuthTokens';

@injectable()
export default class CheckEmailUseCase implements IUseCase<CheckEmailInputDTO, CheckEmailOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: CheckEmailInputDTO): Promise<Result<CheckEmailOutputDTO, ApplicationError>>{
        const exists = await this.userRepository.emailExists(input.email);
        return Result.ok({ exists });
    }
};