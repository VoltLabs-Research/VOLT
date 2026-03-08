import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/application/dtos/UpdateAccountDTO';
import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import User, { UserProps } from '@modules/auth/domain/entities/User';

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

        const normalizedEmail = input.email
            ? User.normalizeEmail(input.email)
            : undefined;

        if (normalizedEmail && normalizedEmail !== user.props.email) {
            const exists = await this.userRepository.emailExists(normalizedEmail);
            if(exists){
                return Result.fail(ApplicationError.conflict(
                    ErrorCodes.AUTH_CREDENTIALS_INVALID,
                    'Email already registered'
                ));
            }
        }

        const updateData: Partial<UserProps> = {};
        if (input.firstName) {
            updateData.firstName = User.normalizeName(input.firstName);
        }

        if (input.lastName) {
            updateData.lastName = User.normalizeName(input.lastName);
        }

        if(input.fullName){
            const normalizedFullName = User.splitFullName(input.fullName);

            updateData.firstName = normalizedFullName.firstName;

            if (normalizedFullName.lastName) {
                updateData.lastName = normalizedFullName.lastName;
            } else {
                updateData.lastName = user.props.lastName;
            }
        }

        if (normalizedEmail) {
            updateData.email = normalizedEmail;
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
            _id: updatedUser._id,
            ...updatedUser.props,
            fullName: `${updatedUser.props.firstName} ${updatedUser.props.lastName}`.trim()
        });
    }
}
