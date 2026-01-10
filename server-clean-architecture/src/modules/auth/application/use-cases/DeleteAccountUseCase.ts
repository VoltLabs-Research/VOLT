import { IUseCase } from "@/src/shared/application/IUseCase";
import { Result } from "@/src/shared/domain/Result";
import ApplicationError from "@/src/shared/application/errors/ApplicationErrors";
import { DeleteAccountInputDTO, DeleteAccountOutputDTO } from "../dtos/DeleteAccountDTO";
import { IUserRepository } from "../../domain/ports/IUserRepository";
import { ErrorCodes } from "@/src/core/constants/error-codes";
import { injectable, inject } from "tsyringe";
import { AUTH_TOKENS } from "../../infrastructure/di/AuthTokens";

@injectable()
export default class DeleteAccountUseCase implements IUseCase<DeleteAccountInputDTO, DeleteAccountOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository
    ){}

    async execute(input: DeleteAccountInputDTO): Promise<Result<DeleteAccountOutputDTO, ApplicationError>>{
        const user = await this.userRepository.findById(input.id);
        if(!user){
            return Result.fail(ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            ));
        }

        await this.userRepository.deleteById(input.id);
        return Result.ok({ success: true });
    }
};