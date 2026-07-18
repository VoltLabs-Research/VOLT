import { ErrorCodes } from '@core/constants/error-codes';
import type { CheckEmailInputDTO, CheckEmailOutputDTO } from '@modules/auth/dtos/CheckEmailDTO';
import type { DeleteAccountInputDTO, DeleteAccountOutputDTO } from '@modules/auth/dtos/DeleteAccountDTO';
import type { GetGuestIdentityInputDTO, GetGuestIdentityOutputDTO } from '@modules/auth/dtos/GetGuestIdentityDTO';
import type { GetMyAccountInputDTO, GetMyAccountOutputDTO } from '@modules/auth/dtos/GetMyAccountDTO';
import type { GetPasswordInfoInputDTO, GetPasswordInfoOutputDTO } from '@modules/auth/dtos/GetPasswordInfoDTO';
import { toPersistedUserDTO } from '@modules/auth/dtos/PersistedUserDTO';
import type { SignInInputDTO, SignInOutputDTO } from '@modules/auth/dtos/SignInDTO';
import type { SignUpInputDTO, SignUpOutputDTO } from '@modules/auth/dtos/SignUpDTO';
import type { UpdateAccountInputDTO, UpdateAccountOutputDTO } from '@modules/auth/dtos/UpdateAccountDTO';
import type { UpdatePasswordInputDTO, UpdatePasswordOutputDTO } from '@modules/auth/dtos/UpdatePasswordDTO';
import UpdateAccountUseCase from '@modules/auth/use-cases/UpdateAccountUseCase';
import User, { OAuthProvider, UserRole } from '@modules/auth/entities/User';
import UserCreatedEvent from '@modules/auth/events/UserCreatedEvent';
import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import { validatePassword } from '@modules/auth/domain/password-policy';
import type { IAuthSessionService } from '@modules/auth/ports/IAuthSessionService';
import type { IAvatarService } from '@modules/auth/ports/IAvatarService';
import type { IPasswordHasher } from '@modules/auth/ports/IPasswordHasher';
import type { IUserRepository } from '@modules/auth/ports/IUserRepository';
import { AUTH_TOKENS } from '@modules/auth/di/AuthTokens';
import { getConfiguredOAuthProviders } from '@modules/auth/oauth/config';
import { SessionActivityType } from '@modules/session/entities/Session';
import type { ISessionRepository } from '@modules/session/ports/ISessionRepository';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/ports/team/INewMemberDefaultTeamEnroller';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { SESSION_CONTRACT_TOKENS } from '@shared/contracts/tokens/SessionTokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import crypto from 'node:crypto';
import { inject } from 'tsyringe';

/**
 * Credential-less sign-in for the single-tenant desktop deployment. Request
 * context only — the canonical local user is looked up by AuthService.
 */
export interface LocalSignInInput {
    ip: string;
    userAgent: string;
}

export interface GetOAuthProvidersOutputDTO {
    providers: OAuthProvider[];
}

/**
 * The single application service for the auth module. Each method folds the
 * exact logic of a previously separate use case, converting the Result error
 * channel to thrown `ApplicationError`s so Express 5 forwards them to the
 * global error middleware. `updateAccount` delegates to the retained
 * {@link UpdateAccountUseCase} (still consumed by the profile AI tool).
 */
@Singleton(AUTH_TOKENS.AuthService)
export default class AuthService {
    private static readonly LOCAL_USER_EMAIL = 'local@volt.local';

    constructor(
        @inject(AUTH_TOKENS.UserRepository) private readonly userRepository: IUserRepository,
        @inject(AUTH_TOKENS.PasswordHasher) private readonly passwordHasher: IPasswordHasher,
        @inject(AUTH_TOKENS.AuthSessionService) private readonly authSessionService: IAuthSessionService,
        @inject(AUTH_TOKENS.AvatarService) private readonly avatarService: IAvatarService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus,
        @inject(SESSION_CONTRACT_TOKENS.SessionRepository) private readonly sessionRepository: ISessionRepository,
        @inject(TEAM_CONTRACT_TOKENS.DefaultTeamEnroller) private readonly defaultTeamEnroller: INewMemberDefaultTeamEnroller,
        @inject(UpdateAccountUseCase) private readonly updateAccountUseCase: UpdateAccountUseCase
    ) {}

    async signIn(input: SignInInputDTO): Promise<SignInOutputDTO> {
        const user = await this.userRepository.findByEmailWithPassword(input.email);
        if (!user) {
            await this.sessionRepository.createFailedLogin(
                null,
                input.userAgent,
                input.ip,
                'User not found'
            );

            throw ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            );
        }

        const isPasswordValid = await this.passwordHasher.compare(input.password, user.password);
        if (!isPasswordValid) {
            await this.sessionRepository.createFailedLogin(
                user._id,
                input.userAgent,
                input.ip,
                'Invalid password'
            );

            throw ApplicationError.unauthorized(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Invalid email or password'
            );
        }

        await this.userRepository.updateLastLogin(user._id);

        const token = await this.authSessionService.createSessionWithToken({
            userId: user._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: toPersistedUserDTO(user)
        };
    }

    /**
     * Credential-less sign-in for the single-tenant desktop deployment. Only
     * active when DEPLOYMENT_MODE=local; in cloud mode this behaves as if the
     * route does not exist (404).
     */
    async localSignIn(input: LocalSignInInput): Promise<SignInOutputDTO> {
        if (process.env.DEPLOYMENT_MODE !== 'local') {
            // Invisible in cloud: behave as if the route does not exist.
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'Not found'
            );
        }

        const user = await this.userRepository.findByEmail(AuthService.LOCAL_USER_EMAIL);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'Local user is not provisioned yet'
            );
        }

        const token = await this.authSessionService.createSessionWithToken({
            userId: user._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: toPersistedUserDTO(user)
        };
    }

    async signUp(input: SignUpInputDTO): Promise<SignUpOutputDTO> {
        if (typeof input.email !== 'string' || input.email.trim().length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.AUTH_EMAIL_REQUIRED,
                'Email is required'
            );
        }

        if (typeof input.firstName !== 'string' || input.firstName.trim().length === 0
            || typeof input.lastName !== 'string') {
            throw ApplicationError.badRequest(
                ErrorCodes.AUTH_NAME_REQUIRED,
                'First and last name are required'
            );
        }

        const passwordError = validatePassword(input.password);
        if (passwordError) {
            throw passwordError;
        }

        const email = User.normalizeEmail(input.email);

        const emailExists = await this.userRepository.emailExists(email);
        if (emailExists) {
            throw ApplicationError.conflict(
                ErrorCodes.AUTH_CREDENTIALS_INVALID,
                'Email already registered'
            );
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);

        const newUser = await this.userRepository.create({
            email,
            firstName: User.normalizeName(input.firstName),
            lastName: User.normalizeName(input.lastName),
            password: hashedPassword,
            role: UserRole.User,
            teams: [],
            analyses: []
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
            id: newUser._id,
            firstName: newUser.props.firstName
        }));

        const token = await this.authSessionService.createSessionWithToken({
            userId: newUser._id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: toPersistedUserDTO(newUser)
        };
    }

    async checkEmail(input: CheckEmailInputDTO): Promise<CheckEmailOutputDTO> {
        const exists = await this.userRepository.emailExists(input.email);
        return { exists };
    }

    async getMyAccount(input: GetMyAccountInputDTO): Promise<GetMyAccountOutputDTO> {
        const user = await this.userRepository.findById(input.userId);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            );
        }

        const fullName = `${user.props.firstName} ${user.props.lastName}`.trim();

        return {
            _id: user._id,
            ...user.props,
            fullName
        };
    }

    async getPasswordInfo(input: GetPasswordInfoInputDTO): Promise<GetPasswordInfoOutputDTO> {
        const user = await this.userRepository.findByIdWithPassword(input.userId);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            );
        }

        return {
            hasPassword: !!user.password,
            lastChanged: user.props.passwordChangedAt?.toISOString()
        };
    }

    async getGuestIdentity(input: GetGuestIdentityInputDTO): Promise<GetGuestIdentityOutputDTO> {
        if (typeof input.seed !== 'string' || input.seed.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED,
                'A seed query parameter is required'
            );
        }

        const hash = crypto.createHash('md5').update(input.seed).digest('hex');
        const { buffer } = this.avatarService.generateIdenticon(hash);
        const avatar = `data:image/svg+xml;base64,${buffer.toString('base64')}`;

        const shortHash = hash.substring(0, 4).toUpperCase();

        return {
            avatar,
            firstName: 'Guest',
            lastName: shortHash
        };
    }

    async updatePassword(input: UpdatePasswordInputDTO): Promise<UpdatePasswordOutputDTO> {
        const passwordError = validatePassword(input.password);
        if (passwordError) {
            throw passwordError;
        }

        const user = await this.userRepository.findByIdWithPassword(input.userId);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found'
            );
        }

        if (user.password) {
            if (!input.passwordCurrent) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is required'
                );
            }

            const isCurrentPasswordValid = await this.passwordHasher.compare(
                input.passwordCurrent,
                user.password
            );

            if (!isCurrentPasswordValid) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is incorrect'
                );
            }
        }

        const hashedPassword = await this.passwordHasher.hash(input.password);
        await this.userRepository.updatePassword(input.userId, hashedPassword);

        await this.userRepository.updateLastLogin(input.userId);

        const token = await this.authSessionService.createSessionWithToken({
            userId: input.userId,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.PasswordUpdate
        });

        const updatedUser = await this.userRepository.findById(input.userId);
        if (!updatedUser) {
            throw ApplicationError.notFound(
                ErrorCodes.USER_NOT_FOUND,
                'User not found after update'
            );
        }

        return {
            token,
            user: toPersistedUserDTO(updatedUser)
        };
    }

    async deleteAccount(input: DeleteAccountInputDTO): Promise<DeleteAccountOutputDTO> {
        const user = await this.userRepository.findById(input.userId);
        if (!user) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'User not found'
            );
        }

        const deleted = await this.userRepository.deleteById(input.userId);
        if (deleted) {
            await this.eventBus.publish(new UserDeletedEvent({
                userId: input.userId
            }));
        }

        return { success: true };
    }

    getOAuthProviders(): GetOAuthProvidersOutputDTO {
        return { providers: getConfiguredOAuthProviders() };
    }

    /**
     * Thin delegator to the retained {@link UpdateAccountUseCase} (still used by
     * the profile-update AI tool). Unwraps the Result to the thrown-error
     * channel used by every other AuthService method.
     */
    async updateAccount(input: UpdateAccountInputDTO): Promise<UpdateAccountOutputDTO> {
        return this.updateAccountUseCase.execute(input);
    }
}
