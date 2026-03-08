import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from '@modules/auth/application/dtos/OAuthLoginDTO';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import AuthSessionService from '@modules/auth/services/AuthSessionService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import { Result } from '@shared/domain/port/Result';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import { inject, injectable } from 'tsyringe';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import type { IUseCase } from '@shared/application/IUseCase';

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository)
        private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AuthSessionService)
        private readonly authSessionService: AuthSessionService
    ) {}

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
