import { IUseCase } from "../../../../../shared/application/IUseCase";
import { Result } from "../../../../../shared/domain/Result";
import ApplicationError from "../../../../../shared/application/errors/ApplicationErrors";
import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from "../../dtos/user/OAuthLoginDTO";
import { IUserRepository } from "../../../domain/ports/IUserRepository";
import { ITokenService } from "../../../domain/ports/ITokenService";
import { SessionActivityType } from "../../../domain/entities/Session";
import { ISessionRepository } from "../../../domain/ports/ISessionRepository";

export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: IUserRepository,
        private readonly tokenService: ITokenService,
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: OAuthLoginInputDTO): Promise<Result<OAuthLoginOutputDTO, ApplicationError>>{
        await this.userRepository.updateLastLogin(input.user.id);
        
        const token = this.tokenService.sign(input.user.id);

        await this.sessionRepository.create({
            user: input.user.id,
            token,
            userAgent: input.userAgent,
            ip: input.ip,
            isActive: true,
            lastActivity: new Date(),
            action: SessionActivityType.OAuthLogin,
            success: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            token,
            user: input.user
        });
    }
};