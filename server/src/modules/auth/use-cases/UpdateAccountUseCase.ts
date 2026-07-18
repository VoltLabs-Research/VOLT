import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/dtos/UpdateAccountDTO';
import type { UserProps } from '@modules/auth/entities/User';
import User from '@modules/auth/entities/User';
import type { IAvatarService } from '@modules/auth/ports/IAvatarService';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/di/AuthTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class UpdateAccountUseCase implements IUseCase<UpdateAccountInputDTO, UpdateAccountOutputDTO>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AvatarService) private readonly avatarService: IAvatarService
    ) {}

    async execute(input: UpdateAccountInputDTO): Promise<UpdateAccountOutputDTO>{
        const user = await this.userRepository.findById(input.userId);
        if(!user){
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            );
        }

        let normalizedEmail: string | undefined;
        if (input.email) {
            normalizedEmail = User.normalizeEmail(input.email);
        }

        if (normalizedEmail && normalizedEmail !== user.props.email) {
            const exists = await this.userRepository.emailExists(normalizedEmail);
            if(exists){
                throw ApplicationError.conflict(
                    ErrorCodes.AUTH_CREDENTIALS_INVALID,
                    'Email already registered'
                );
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
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found afer update'
            );
        }

        return {
            _id: updatedUser._id,
            ...updatedUser.props,
            fullName: `${updatedUser.props.firstName} ${updatedUser.props.lastName}`.trim()
        };
    }
}
