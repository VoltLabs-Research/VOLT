import { OAuthLoginInputDTO, OAuthLoginOutputDTO } from '@modules/auth/application/dtos/OAuthLoginDTO';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import type { IAuthSessionService } from '@modules/auth/domain/port/IAuthSessionService';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/domain/port/team/INewMemberDefaultTeamEnroller';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class OAuthLoginUseCase implements IUseCase<OAuthLoginInputDTO, OAuthLoginOutputDTO, ApplicationError>{
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        @inject(TEAM_TOKENS.DefaultTeamEnroller) private readonly defaultTeamEnroller: INewMemberDefaultTeamEnroller
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

                await this.eventBus.publish(new UserCreatedEvent({
                    userId: user._id,
                    id: user._id,
                    email: user.props.email,
                    firstName: user.props.firstName,
                    lastName: user.props.lastName
                }));

                try {
                    await this.defaultTeamEnroller.enrollIfConfigured(user._id);
                } catch (err) {
                    logger.error(err, '[OAuthLogin] default-team enrollment failed');
                }
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
