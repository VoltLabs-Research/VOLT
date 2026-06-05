import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/application/dtos/UpdateAccountDTO';
import type { UserProps } from '@modules/auth/domain/entities/User';
import User from '@modules/auth/domain/entities/User';
import type { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class UpdateAccountUseCase implements IUseCase<UpdateAccountInputDTO, UpdateAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AvatarService) private readonly avatarService: IAvatarService
    ) {}

    async execute(input: UpdateAccountInputDTO): Promise<Result<UpdateAccountOutputDTO, ApplicationError>>{
        const user = await this.userRepository.findById(input.userId);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        let normalizedEmail: string | undefined;
        if (input.email) {
            normalizedEmail = User.normalizeEmail(input.email);
        }

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
