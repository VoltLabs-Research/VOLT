import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/application/dtos/UpdateAccountDTO';
import { IUserRepository } from '@modules/auth/domain/ports/IUserRepository';
import { IAvatarService } from '@modules/auth/domain/ports/IAvatarService';
import validator from 'validator';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { UserProps } from '@modules/auth/domain/entities/User';

@injectable()
export default class UpdateAccountUseCase implements IUseCase<UpdateAccountInputDTO, UpdateAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AvatarService)
        private readonly avatarService: IAvatarService
    ){}

    async execute(input: UpdateAccountInputDTO): Promise<Result<UpdateAccountOutputDTO, ApplicationError>>{
        const user = await this.userRepository.findById(input.userId);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        if(input.email && !validator.isEmail(input.email)){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email format'
            ));
        }

        if(input.email && input.email !== user.props.email){
            const exists = await this.userRepository.emailExists(input.email);
            if(exists){
                return Result.fail(ApplicationError.conflict(
                    ErrorCodes.AUTH_CREDENTIALS_INVALID,
                    'Email already registered'
                ));
            }
        }

        const updateData: Partial<UserProps> = {};
        if(input.firstName) updateData.firstName = input.firstName;
        if(input.lastName) updateData.lastName = input.lastName;

        if(input.fullName){
            const normalizedFullName = input.fullName.trim().replace(/\s+/g, ' ');
            if(normalizedFullName){
                const parts = normalizedFullName.split(' ');
                updateData.firstName = parts[0];
                updateData.lastName = parts.length > 1
                    ? parts.slice(1).join(' ')
                    : user.props.lastName;
            }
        }

        if(input.email){
            updateData.email = input.email.toLowerCase().trim();
        }

        if(input.file?.buffer){
            const avatar = await this.avatarService.uploadCustomAvatar(input.userId, input.file.buffer);
            updateData.avatar = avatar;
        }

        const updatedUser = await this.userRepository.updateById(input.userId, updateData);
        if(!updatedUser){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found afer update'
            ));
        }

        return Result.ok({
            _id: updatedUser.id,
            ...updatedUser.props,
            fullName: `${updatedUser.props.firstName} ${updatedUser.props.lastName}`.trim()
        });
    }
}