import { IUseCase } from "../../../../shared/application/IUseCase";
import { Result } from "../../../../shared/domain/Result";
import ApplicationError from "../../../../shared/application/errors/ApplicationErrors";
import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from "../dtos/OAuthLoginDTO";
import { IUserRepository } from "../../domain/ports/IUserRepository";
import { ITokenService } from "../../domain/ports/ITokenService";
import { SessionActivityType } from "@/src/modules/session/domain/entities/Session";
import { ISessionRepository } from "../../../session/domain/ports/ISessionRepository";
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from "../../infrastructure/di/AuthTokens";
import generateRandomName from "@/src/shared/infrastructure/utilities/generate-random-name";

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.JwtTokenService)
        private readonly tokenService: ITokenService,
        @inject(AUTH_TOKENS.SessionRepository)
        private readonly sessionRepository: ISessionRepository
    ){}

    async execute(input: OAuthLoginInputDTO): Promise<Result<OAuthLoginOutputDTO, ApplicationError>>{
        // Check if user exists with this OAuth provider
        let user = await this.userRepository.findOne({
            oauthProvider: input.oauthProvider,
            oauthId: input.oauthId
        });

        if(!user){
            // Check if user exists with this emaill
            user = await this.userRepository.findByEmail(input.email);
            
            if(user){
                // Link the OAuthProvider with the existing user account
                await this.userRepository.updateById(user.id, {
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    avatar: input.avatar || user.props.avatar
                });
            }else{
                // Create new user and link the OAuthProvider
                const randomName = generateRandomName(input.oauthId);
                user = await this.userRepository.create({
                    email: input.email,
                    firstName: input.firstName ?? randomName.firstName,
                    lastName: input.lastName ?? randomName.lastName,
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    teams: [],
                    analyses: []
                });
            }
        }

        await this.userRepository.updateLastLogin(user.id);
        const token = this.tokenService.sign(user.id);

        await this.sessionRepository.create({
            user: user.id,
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
            user: user.props, 
            token 
        });
    }
};