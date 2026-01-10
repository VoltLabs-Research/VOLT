import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { UpdateAccountInputDTO, UpdateAccountOutputDTO } from "../dtos/UpdateAccountDTO";
import { IUserRepository } from "../../domain/ports/IUserRepository";
import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../infrastructure/di/AuthTokens";
import { UserProps } from "../../domain/entities/User";

@injectable()
export default class UpdateAccountUseCase implements IUseCase<UpdateAccountInputDTO, UpdateAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: UpdateAccountInputDTO): Promise<Result<UpdateAccountOutputDTO, ApplicationError>>{
        const user = this.userRepository.findById(input.id);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        const updateData: Partial<UserProps> = {};
        if(input.firstName) updateData.firstName = input.firstName;
        if(input.lastName) updateData.lastName = input.lastName;

        const updatedUser = await this.userRepository.updateById(input.id, updateData);
        if(!updatedUser){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found afer update'
            ));
        }

        return Result.ok({
            user: updatedUser
        });
    }
}