import { IUseCase } from '../../../../../shared/application/IUseCase';
import { Result } from '../../../../../shared/domain/Result';
import { CheckEmailInputDTO, CheckEmailOutputDTO } from '../../dtos/user/CheckEmailDTO';
import { IUserRepository } from '../../../domain/ports/IUserRepository';
import ApplicationError from '../../../../../shared/application/errors/ApplicationErrors';

export default class CheckEmailUseCase implements IUseCase<CheckEmailInputDTO, CheckEmailOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: CheckEmailInputDTO): Promise<Result<CheckEmailOutputDTO, ApplicationError>>{
        const exists = await this.userRepository.emailExists(input.email);
        return Result.ok({ exists });
    }
};