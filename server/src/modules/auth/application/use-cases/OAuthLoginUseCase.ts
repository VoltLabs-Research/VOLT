import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from '@modules/auth/application/dtos/OAuthLoginDTO';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import UserRepository from '@modules/auth/infrastructure/persistence/mongo/repositories/UserRepository';
import AuthSessionService from '@modules/auth/infrastructure/services/AuthSessionService';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import { injectable } from 'tsyringe';

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        private readonly userRepository: UserRepository,
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
}
