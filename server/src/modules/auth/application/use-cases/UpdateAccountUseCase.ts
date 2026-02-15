import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/application/dtos/UpdateAccountDTO';
import { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { UserProps } from '@modules/auth/domain/entities/User';

@injectable()
export default class UpdateAccountUseCase implements IUseCase<UpdateAccountInputDTO, UpdateAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: UpdateAccountInputDTO): Promise<Result<UpdateAccountOutputDTO, ApplicationError>>{
        const user = this.userRepository.findById(input.userId);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        const updateData: Partial<UserProps> = {};
        if(input.firstName) updateData.firstName = input.firstName;
        if(input.lastName) updateData.lastName = input.lastName;

        const updatedUser = await this.userRepository.updateById(input.userId, updateData);
        if(!updatedUser){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found afer update'
            ));
        }

        return Result.ok({
            user: {
                _id: updatedUser.id,
                ...updatedUser.props
            }
        });
    }
}