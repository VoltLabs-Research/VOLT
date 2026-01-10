import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { ErrorCodes } from "../../../../../core/constants/error-codes";
import { UpdatePasswordInputDTO, UpdatePasswordOutputDTO } from "../dtos/UpdatePasswordDTO";
import { IUserRepository } from "../../../domain/ports/IUserRepository";
import { IPasswordHasher } from "../../../domain/ports/IPasswordHasher";
import { ITokenService } from "../../../domain/ports/ITokenService";

export default class UpdatePasswordUseCase implements IUseCase<UpdatePasswordInputDTO, UpdatePasswordOutputDTO, ApplicationError>{
    constructor(
        private readonly useRepository: IUserRepository,
        private readonly passwordHasher: IPasswordHasher,
        private readonly tokenService: ITokenService
    ){}

    async execute(input: UpdatePasswordInputDTO): Promise<Result<UpdatePasswordOutputDTO, ApplicationError>>{
        const user = await this.useRepository.findByIdWithPassword(input.user.id);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            ));
        }

        const isCurrentPasswordValid = await this.passwordHasher.compare(
            input.passwordCurrent,
            user.password
        );

        if(!isCurrentPasswordValid){
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                'Current password is incorrect'
            ));
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);
        await this.useRepository.updatePassword(input.user.id, hashedPassword);

        await this.useRepository.updateLastLogin(input.user.id);

        const token = this.tokenService.sign(input.user.id);

        // TODO:
        // @ts-ignore
        return Result.ok({
            token,
            user
        });
    }
};