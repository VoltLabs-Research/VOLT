import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from '@modules/auth/application/dtos/OAuthLoginDTO';
import { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { injectable, inject } from 'tsyringe';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import AuthSessionService from '@modules/auth/application/services/AuthSessionService';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AuthSessionService)
        private readonly authSessionService: AuthSessionService
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
                await this.userRepository.updateById(user._id, {
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

        await this.userRepository.updateLastLogin(user._id);

        const token = await this.authSessionService.createSessionWithToken({
            userId: user._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.OAuthLogin
        });

        return Result.ok({ 
            user: toPersistedUserDTO(user), 
            token 
        });
    }
};
