import { ErrorCodes } from '@core/constants/error-codes';
import UserModel from '@modules/auth/models/UserModel';
import type { UserDocument } from '@modules/auth/models/UserModel';
import User, { OAuthProvider, UserRole } from '@modules/auth/entities/User';
import UserCreatedEvent from '@modules/auth/events/UserCreatedEvent';
import UserDeletedEvent from '@modules/auth/events/UserDeletedEvent';
import { validatePassword } from '@modules/auth/domain/password-policy';
import { getConfiguredOAuthProviders } from '@modules/auth/oauth/providers';
import type { IAuthSessionService } from '@modules/auth/ports/IAuthSessionService';
import type { IAvatarService } from '@modules/auth/ports/IAvatarService';
import type { IPasswordHasher } from '@modules/auth/ports/IPasswordHasher';
import { AUTH_TOKENS } from '@modules/auth/di/AuthTokens';
import { SessionActivityType } from '@modules/session/entities/Session';
import type { ISessionRepository } from '@modules/session/ports/ISessionRepository';
import type { INewMemberDefaultTeamEnroller } from '@modules/team/ports/team/INewMemberDefaultTeamEnroller';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { SESSION_CONTRACT_TOKENS } from '@shared/contracts/tokens/SessionTokens';
import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import type {
    SignInInput,
    SignUpInput,
    UpdatePasswordInput,
    UpdateAccountInput
} from '@volt/contracts/modules/auth/http';
import crypto from 'node:crypto';
import { container as diContainer } from 'tsyringe';

/** Server-derived request context attached to every credentialed entry point. */
interface RequestContext {
    ip: string;
    userAgent: string;
}

/** OAuth login input assembled by the passport strategies (folds OAuthLoginUseCase). */
export interface OAuthLoginInput extends RequestContext {
    email: string;
    firstName?: string;
    lastName?: string;
    oauthProvider: OAuthProvider;
    oauthId: string;
    avatar?: string;
}

type WireUser = Record<string, unknown>;

interface AuthSessionResult {
    token: string;
    user: WireUser;
}

/**
 * The single application service for the auth module (pollium/container style):
 * holds ALL the auth HTTP domain logic, talks to the Mongoose {@link UserModel}
 * directly, and throws typed {@link ApplicationError}s (no Result channel) so
 * Express 5 forwards them to the global error middleware. `signIn`, `signUp`,
 * `updatePassword`, `deleteAccount`, `updateAccount` and `oauthLogin` fold the
 * exact logic of the previously separate use cases.
 *
 * It has no DI decorator and is `new`ed by the controller / AI tool / OAuth
 * composition root. Its genuinely-shared collaborators stay DI singletons and
 * are resolved once into private fields (mirroring `ContainerService`):
 *  - passwordHasher / tokenService (via authSessionService): infra singletons
 *    also consumed by the `protect` middleware.
 *  - avatarService: holds the shared MinIO storage client.
 *  - authSessionService: issues JWTs + writes the session audit row.
 *  - eventBus: the shared Redis event bus.
 *  - sessionRepository / defaultTeamEnroller: cross-module singletons (session
 *    audit rows, default-team enrolment) owned by other modules.
 * The user COLLECTION is read/written through `UserModel` here; the model-backed
 * {@link UserRepository} adapter survives only to answer the neutral
 * `AUTH_CONTRACT_TOKENS.UserRepository` token for cross-module consumers.
 */
export default class AuthService {
    private static readonly LOCAL_USER_EMAIL = 'local@volt.local';

    #passwordHasher = diContainer.resolve<IPasswordHasher>(AUTH_TOKENS.PasswordHasher);
    #authSessionService = diContainer.resolve<IAuthSessionService>(AUTH_TOKENS.AuthSessionService);
    #avatarService = diContainer.resolve<IAvatarService>(AUTH_TOKENS.AvatarService);
    #eventBus = diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus);
    #sessionRepository = diContainer.resolve<ISessionRepository>(SESSION_CONTRACT_TOKENS.SessionRepository);
    #defaultTeamEnroller = diContainer.resolve<INewMemberDefaultTeamEnroller>(TEAM_CONTRACT_TOKENS.DefaultTeamEnroller);

    async signIn(input: SignInInput, context: RequestContext): Promise<AuthSessionResult> {
        const user = await UserModel.findOne({ email: input.email.toLowerCase() }).select('+password');
        if (!user) {
            await this.#sessionRepository.createFailedLogin(null, context.userAgent, context.ip, 'User not found');
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Invalid email or password');
        }

        const isPasswordValid = await this.#passwordHasher.compare(input.password, user.password ?? '');
        if (!isPasswordValid) {
            await this.#sessionRepository.createFailedLogin(String(user._id), context.userAgent, context.ip, 'Invalid password');
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Invalid email or password');
        }

        await this.#updateLastLogin(String(user._id));

        const token = await this.#authSessionService.createSessionWithToken({
            userId: String(user._id),
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return { token, user: this.#presentUser(user) };
    }

    /**
     * Credential-less sign-in for the single-tenant desktop deployment. Only
     * active when DEPLOYMENT_MODE=local; in cloud mode this behaves as if the
     * route does not exist (404).
     */
    async localSignIn(context: RequestContext): Promise<AuthSessionResult> {
        if (process.env.DEPLOYMENT_MODE !== 'local') {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'Not found');
        }

        const user = await UserModel.findOne({ email: AuthService.LOCAL_USER_EMAIL.toLowerCase() });
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'Local user is not provisioned yet');
        }

        const token = await this.#authSessionService.createSessionWithToken({
            userId: String(user._id),
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return { token, user: this.#presentUser(user) };
    }

    async signUp(input: SignUpInput, context: RequestContext): Promise<AuthSessionResult> {
        if (typeof input.email !== 'string' || input.email.trim().length === 0) {
            throw ApplicationError.badRequest(ErrorCodes.AUTH_EMAIL_REQUIRED, 'Email is required');
        }

        if (typeof input.firstName !== 'string' || input.firstName.trim().length === 0
            || typeof input.lastName !== 'string') {
            throw ApplicationError.badRequest(ErrorCodes.AUTH_NAME_REQUIRED, 'First and last name are required');
        }

        const passwordError = validatePassword(input.password);
        if (passwordError) {
            throw passwordError;
        }

        const email = User.normalizeEmail(input.email);

        if (await this.#emailExists(email)) {
            throw ApplicationError.conflict(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Email already registered');
        }

        const hashedPassword = await this.#passwordHasher.hash(input.password);

        const newUser = await UserModel.create({
            email,
            firstName: User.normalizeName(input.firstName),
            lastName: User.normalizeName(input.lastName),
            password: hashedPassword,
            role: UserRole.User,
            teams: [],
            analyses: []
        });

        const avatar = await this.#avatarService.generateAndUploadDefaultAvatar(String(newUser._id), newUser.email);
        newUser.avatar = avatar;
        await newUser.save();

        try {
            await this.#defaultTeamEnroller.enrollIfConfigured(String(newUser._id));
        } catch (err) {
            logger.error(err, '[SignUp] default-team enrollment failed');
        }

        await this.#eventBus.publish(new UserCreatedEvent({
            id: String(newUser._id),
            firstName: newUser.firstName
        }));

        const token = await this.#authSessionService.createSessionWithToken({
            userId: String(newUser._id),
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return { token, user: this.#presentUser(newUser) };
    }

    async checkEmail(email: string): Promise<{ exists: boolean }> {
        return { exists: await this.#emailExists(email) };
    }

    async getMyAccount(userId: string): Promise<WireUser & { fullName: string }> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }
        return this.#presentAccount(user);
    }

    async getPasswordInfo(userId: string): Promise<{ hasPassword: boolean; lastChanged?: string }> {
        const user = await UserModel.findById(userId).select('+password');
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }
        return {
            hasPassword: !!user.password,
            lastChanged: user.passwordChangedAt?.toISOString()
        };
    }

    getGuestIdentity(seed: string): { firstName: string; lastName: string; avatar: string } {
        if (typeof seed !== 'string' || seed.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED,
                'A seed query parameter is required'
            );
        }

        const hash = crypto.createHash('md5').update(seed).digest('hex');
        const { buffer } = this.#avatarService.generateIdenticon(hash);
        const avatar = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
        const shortHash = hash.substring(0, 4).toUpperCase();

        return { avatar, firstName: 'Guest', lastName: shortHash };
    }

    async updatePassword(userId: string, input: UpdatePasswordInput, context: RequestContext): Promise<AuthSessionResult> {
        const passwordError = validatePassword(input.password);
        if (passwordError) {
            throw passwordError;
        }

        const user = await UserModel.findById(userId).select('+password');
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }

        if (user.password) {
            if (!input.passwordCurrent) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is required'
                );
            }

            const isCurrentPasswordValid = await this.#passwordHasher.compare(input.passwordCurrent, user.password);
            if (!isCurrentPasswordValid) {
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is incorrect'
                );
            }
        }

        const hashedPassword = await this.#passwordHasher.hash(input.password);
        await UserModel.findByIdAndUpdate(userId, {
            password: hashedPassword,
            passwordChangedAt: new Date(Date.now() - 1000)
        });

        await this.#updateLastLogin(userId);

        const token = await this.#authSessionService.createSessionWithToken({
            userId,
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.PasswordUpdate
        });

        const updatedUser = await UserModel.findById(userId);
        if (!updatedUser) {
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found after update');
        }

        return { token, user: this.#presentUser(updatedUser) };
    }

    async deleteAccount(userId: string): Promise<{ success: boolean }> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
        }

        const { deletedCount } = await UserModel.deleteOne({ _id: userId });
        if (deletedCount > 0) {
            await this.#eventBus.publish(new UserDeletedEvent({ userId }));
        }

        return { success: true };
    }

    getOAuthProviders(): { providers: OAuthProvider[] } {
        return { providers: getConfiguredOAuthProviders() };
    }

    /**
     * Update the current user's profile. Folds the retained UpdateAccountUseCase
     * (still driven by the profile-update AI tool). `file` is the multipart avatar
     * upload, present only on the HTTP path.
     */
    async updateAccount(
        userId: string,
        input: UpdateAccountInput,
        file?: Express.Multer.File
    ): Promise<WireUser & { fullName: string }> {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
        }

        let normalizedEmail: string | undefined;
        if (input.email) {
            normalizedEmail = User.normalizeEmail(input.email);
        }

        if (normalizedEmail && normalizedEmail !== user.email) {
            if (await this.#emailExists(normalizedEmail)) {
                throw ApplicationError.conflict(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Email already registered');
            }
        }

        const updateData: Record<string, unknown> = {};
        if (input.firstName) {
            updateData.firstName = User.normalizeName(input.firstName);
        }
        if (input.lastName) {
            updateData.lastName = User.normalizeName(input.lastName);
        }
        if (input.fullName) {
            const normalizedFullName = User.splitFullName(input.fullName);
            updateData.firstName = normalizedFullName.firstName;
            updateData.lastName = normalizedFullName.lastName ?? user.lastName;
        }
        if (normalizedEmail) {
            updateData.email = normalizedEmail;
        }
        if (file?.buffer) {
            updateData.avatar = await this.#avatarService.uploadCustomAvatar(userId, file.buffer);
        }

        const updatedUser = await UserModel.findByIdAndUpdate(userId, updateData, { new: true });
        if (!updatedUser) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found afer update');
        }

        return this.#presentAccount(updatedUser);
    }

    /**
     * OAuth login/link (folds OAuthLoginUseCase). Called by the passport
     * strategies with a normalized (lower-cased) email.
     */
    async oauthLogin(input: OAuthLoginInput): Promise<AuthSessionResult> {
        let user = await UserModel.findOne({ oauthProvider: input.oauthProvider, oauthId: input.oauthId });

        if (!user) {
            const existingByEmail = await UserModel.findOne({ email: input.email.toLowerCase() });

            if (existingByEmail) {
                await UserModel.updateOne({ _id: existingByEmail._id }, {
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    avatar: input.avatar || existingByEmail.avatar
                });
                user = existingByEmail;
            } else {
                const randomName = generateRandomName(input.oauthId);
                user = await UserModel.create({
                    email: input.email,
                    firstName: input.firstName ?? randomName.firstName,
                    lastName: input.lastName ?? randomName.lastName,
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    teams: [],
                    analyses: []
                });

                await this.#eventBus.publish(new UserCreatedEvent({
                    id: String(user._id),
                    firstName: user.firstName
                }));

                try {
                    await this.#defaultTeamEnroller.enrollIfConfigured(String(user._id));
                } catch (err) {
                    logger.error(err, '[OAuthLogin] default-team enrollment failed');
                }
            }
        }

        await this.#updateLastLogin(String(user._id));

        const token = await this.#authSessionService.createSessionWithToken({
            userId: String(user._id),
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.OAuthLogin
        });

        return { user: this.#presentUser(user), token };
    }

    // ---- Internal helpers -------------------------------------------------

    async #emailExists(email: string): Promise<boolean> {
        const existing = await UserModel.exists({ email: email.toLowerCase() });
        return !!existing;
    }

    async #updateLastLogin(userId: string): Promise<void> {
        const now = new Date();
        await UserModel.findByIdAndUpdate(userId, { lastLoginAt: now, lastSeenAt: now });
    }

    /**
     * The client-facing user shape: `_id` as a string, ref arrays coerced to
     * string ids, and the password field stripped — reproducing the old
     * `toPersistedUserDTO(user)` output exactly (dates stay `Date` objects and
     * are serialized to ISO strings by `BaseResponse`).
     */
    #presentUser(doc: UserDocument): WireUser {
        const view = doc.toObject() as Record<string, unknown>;
        delete view.password;
        delete view.__v;
        view._id = String(doc._id);
        view.teams = (doc.teams ?? []).map((team) => String(team));
        view.analyses = (doc.analyses ?? []).map((analysis) => String(analysis));
        return view;
    }

    /** `GET /me` / profile update add a derived `fullName` on top of the user. */
    #presentAccount(doc: UserDocument): WireUser & { fullName: string } {
        const user = this.#presentUser(doc);
        return {
            ...user,
            fullName: `${doc.firstName} ${doc.lastName}`.trim()
        };
    }
}
