import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from "../dtos/OAuthLoginDTO";
import { IUserRepository } from "../../../domain/ports/IUserRepository";
import { ITokenService } from "../../../domain/ports/ITokenService";

export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: ITokenService
    ){}

    async execute(input: OAuthLoginInputDTO): Promise<Result<OAuthLoginOutputDTO, ApplicationError>>{
        await this.userRepository.updateLastLogin(input.user.id);
        
        const token = this.tokenService.sign(input.user.id);

        return Result.ok({
            token,
            user: input.user
        });
    }
};