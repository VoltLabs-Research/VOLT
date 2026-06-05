import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from '@modules/auth/application/dtos/OAuthLoginDTO';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import type { IAuthSessionService } from '@modules/auth/domain/port/IAuthSessionService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService
    ) {}

    async execute(input: OAuthLoginInputDTO): Promise<Result<OAuthLoginOutputDTO, ApplicationError>>{
        let user = await this.userRepository.findOne({
            oauthProvider: input.oauthProvider,
            oauthId: input.oauthId
        });

        if(!user){
            user = await this.userRepository.findByEmail(input.email);

            if(user){
                await this.userRepository.updateById(user._id, {
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    avatar: input.avatar || user.props.avatar
                });
            }else{
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
