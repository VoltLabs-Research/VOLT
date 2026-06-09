import { ErrorCodes } from '@core/constants/error-codes';
import { toPersistedUserDTO } from '@modules/auth/application/dtos/PersistedUserDTO';
import { SignUpInputDTO, SignUpOutputDTO } from '@modules/auth/application/dtos/SignUpDTO';
import User, { UserRole } from '@modules/auth/domain/entities/User';
import type { IAuthSessionService } from '@modules/auth/domain/port/IAuthSessionService';
import type { IAvatarService } from '@modules/auth/domain/port/IAvatarService';
import type { IPasswordHasher } from '@modules/auth/domain/port/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/domain/port/IUserRepository';
import UserCreatedEvent from '@modules/auth/domain/events/UserCreatedEvent';
import { AUTH_TOKENS } from '@modules/auth/infrastructure/di/AuthTokens';
import { SessionActivityType } from '@modules/session/domain/entities/Session';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/domain/port/team/INewMemberDefaultTeamEnroller';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import type { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';

@injectable()
export default class SignUpUseCase implements IUseCase<SignUpInputDTO, SignUpOutputDTO, ApplicationError> {
    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.PasswordHasher) private readonly passwordHasher: IPasswordHasher,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        @inject(AUTH_TOKENS.AvatarService) private readonly avatarService: IAvatarService,
        @inject(TEAM_TOKENS.DefaultTeamEnroller) private readonly defaultTeamEnroller: INewMemberDefaultTeamEnroller
    ) {}

    async execute(input: SignUpInputDTO): Promise<Result<SignUpOutputDTO, ApplicationError>> {
        const email = User.normalizeEmail(input.email);

        const emailExists = await this.userRepository.emailExists(email);
        if (emailExists) {
            return Result.fail(ApplicationError.conflict(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Email already registered'
            ));
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);

        const newUser = await this.userRepository.create({
            email,
            firstName: User.normalizeName(input.firstName),
            lastName: User.normalizeName(input.lastName),
            password: hashedPassword,
            role: UserRole.User,
            teams: [],
            analyses: [],
            lastLoginAt: new Date(),
            lastSeenAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const avatar = await this.avatarService.generateAndUploadDefaultAvatar(newUser._id, newUser.props.email);
        await this.userRepository.updateById(newUser._id, { avatar });
        newUser.props.avatar = avatar;

        try {
            await this.defaultTeamEnroller.enrollIfConfigured(newUser._id);
        } catch (err) {
            logger.error(err, '[SignUp] default-team enrollment failed');
        }

        await this.eventBus.publish(new UserCreatedEvent({
            userId: newUser._id,
            id: newUser._id,
            email: newUser.props.email,
            firstName: newUser.props.firstName,
            lastName: newUser.props.lastName
        }));

        const token = await this.authSessionService.createSessionWithToken({
            userId: newUser._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.Login
        });

        return Result.ok({
            token,
            user: toPersistedUserDTO(newUser)
        });
    }
}
