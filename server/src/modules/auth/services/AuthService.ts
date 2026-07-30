import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import User from '@modules/auth/models/User';
import {
    UserRole,
    normalizeEmail,
    normalizeName,
    splitFullName
} from '@modules/auth/contracts/user';
import type { OAuthProvider } from '@modules/auth/contracts/user';
import AuthSessionService from '@modules/auth/services/AuthSessionService';
import AvatarService from '@modules/auth/services/AvatarService';
import BcryptPasswordHasher from '@modules/auth/services/BcryptPasswordHasher';
import { getConfiguredOAuthProviders } from '@modules/auth/services/oauth/config';
import Session from '@modules/session/models/Session';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import DefaultTeamEnroller from '@modules/team/services/team/DefaultTeamEnroller';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import generateRandomName from '@shared/infrastructure/utilities/generate-random-name';
import type {
    SignInInput,
    SignUpInput,
    UpdatePasswordInput,
    UpdateAccountInput
} from '@volt/contracts/modules/auth/http';
import crypto from 'node:crypto';

const PASSWORD_MIN_LENGTH = 8;

const validatePassword = (password: unknown): ApplicationError | null => {
    if(typeof password !== 'string' || password.length === 0){
        return ApplicationError.badRequest(
            ErrorCodes.AUTH_PASSWORD_REQUIRED,
            'Password is required'
        );
    }

    if([...password].length < PASSWORD_MIN_LENGTH){
        return ApplicationError.badRequest(
            ErrorCodes.AUTH_PASSWORD_TOO_SHORT,
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
        );
    }

    return null;
};

interface RequestContext{
    ip: string;
    userAgent: string;
}

interface OAuthLoginInput extends RequestContext{
    email: string;
    firstName?: string;
    lastName?: string;
    oauthProvider: OAuthProvider;
    oauthId: string;
    avatar?: string;
}

type WireUser = Record<string, unknown>;

interface AuthSessionResult{
    token: string;
    user: WireUser;
}

export default class AuthService{
    private static readonly LOCAL_USER_EMAIL = 'local@volt.local';

    #passwordHasher = new BcryptPasswordHasher();
    #authSessionService = new AuthSessionService();
    #avatarService = new AvatarService();
    #eventBus = eventBus;
    #defaultTeamEnroller = new DefaultTeamEnroller();

    async signIn(input: SignInInput, context: RequestContext): Promise<AuthSessionResult>{
        const user = await User.findOneBy({ email: normalizeEmail(input.email) });
        if(!user){
            await this.#createFailedLogin(null, context.userAgent, context.ip);
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Invalid email or password');
        }

        const isPasswordValid = await this.#passwordHasher.compare(input.password, user.password ?? '');
        if(!isPasswordValid){
            await this.#createFailedLogin(user.id, context.userAgent, context.ip);
            throw ApplicationError.unauthorized(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Invalid email or password');
        }

        await this.#updateLastLogin(user.id);

        const token = await this.#authSessionService.createSessionWithToken({
            userId: user.id,
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: this.#presentUser(user)
        };
    }

    async localSignIn(context: RequestContext): Promise<AuthSessionResult>{
        if(process.env.DEPLOYMENT_MODE !== 'local'){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'Not found');
        }

        const user = await User.findOneBy({ email: normalizeEmail(AuthService.LOCAL_USER_EMAIL) });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'Local user is not provisioned yet');
        }

        const token = await this.#authSessionService.createSessionWithToken({
            userId: user.id,
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: this.#presentUser(user)
        };
    }

    async signUp(input: SignUpInput, context: RequestContext): Promise<AuthSessionResult>{
        if(typeof input.email !== 'string' || input.email.trim().length === 0){
            throw ApplicationError.badRequest(ErrorCodes.AUTH_EMAIL_REQUIRED, 'Email is required');
        }

        if(typeof input.firstName !== 'string' || input.firstName.trim().length === 0
            || typeof input.lastName !== 'string'){
            throw ApplicationError.badRequest(ErrorCodes.AUTH_NAME_REQUIRED, 'First and last name are required');
        }

        const passwordError = validatePassword(input.password);
        if(passwordError){
            throw passwordError;
        }

        const email = normalizeEmail(input.email);

        if(await this.#emailExists(email)){
            throw ApplicationError.conflict(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Email already registered');
        }

        const hashedPassword = await this.#passwordHasher.hash(input.password);

        const newUser = await User.create({
            email,
            firstName: normalizeName(input.firstName),
            lastName: normalizeName(input.lastName),
            password: hashedPassword,
            role: UserRole.User,
            teams: [],
            analyses: []
        }).save();

        const avatar = await this.#avatarService.generateAndUploadDefaultAvatar(newUser.id, newUser.email);
        await Object.assign(newUser, { avatar }).save();

        try{
            await this.#defaultTeamEnroller.enrollIfConfigured(newUser.id);
        }catch(err){
            logger.error(err, '[SignUp] default-team enrollment failed');
        }

        await this.#eventBus.emit('user.created', {
            id: newUser.id,
            firstName: newUser.firstName
        });

        const token = await this.#authSessionService.createSessionWithToken({
            userId: newUser.id,
            ip: context.ip,
            userAgent: context.userAgent,
            activityType: SessionActivityType.Login
        });

        return {
            token,
            user: this.#presentUser(newUser)
        };
    }

    async checkEmail(email: string): Promise<{ exists: boolean }>{
        return { exists: await this.#emailExists(email) };
    }

    async getMyAccount(userId: string): Promise<WireUser & { fullName: string }>{
        const user = await User.findOneBy({ id: userId });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }
        return this.#presentAccount(user);
    }

    async getPasswordInfo(userId: string): Promise<{ hasPassword: boolean; lastChanged?: string }>{
        const user = await User.findOneBy({ id: userId });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }
        return {
            hasPassword: !!user.password,
            lastChanged: user.passwordChangedAt?.toISOString()
        };
    }

    getGuestIdentity(seed: string): { firstName: string; lastName: string; avatar: string }{
        if(typeof seed !== 'string' || seed.length === 0){
            throw ApplicationError.badRequest(
                ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED,
                'A seed query parameter is required'
            );
        }

        const hash = crypto.createHash('md5').update(seed).digest('hex');
        const { buffer } = this.#avatarService.generateIdenticon(hash);
        const avatar = `data:image/svg+xml;base64,${buffer.toString('base64')}`;
        const shortHash = hash.substring(0, 4).toUpperCase();

        return {
            avatar,
            firstName: 'Guest',
            lastName: shortHash
        };
    }

    async updatePassword(userId: string, input: UpdatePasswordInput, context: RequestContext): Promise<AuthSessionResult>{
        const passwordError = validatePassword(input.password);
        if(passwordError){
            throw passwordError;
        }

        const user = await User.findOneBy({ id: userId });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found');
        }

        if(user.password){
            if(!input.passwordCurrent){
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is required'
                );
            }

            const isCurrentPasswordValid = await this.#passwordHasher.compare(input.passwordCurrent, user.password);
            if(!isCurrentPasswordValid){
                throw ApplicationError.badRequest(
                    ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT,
                    'Current password is incorrect'
                );
            }
        }

        const hashedPassword = await this.#passwordHasher.hash(input.password);
        await User.update({ id: userId }, {
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

        const updatedUser = await User.findOneBy({ id: userId });
        if(!updatedUser){
            throw ApplicationError.notFound(ErrorCodes.USER_NOT_FOUND, 'User not found after update');
        }

        return {
            token,
            user: this.#presentUser(updatedUser)
        };
    }

    async deleteAccount(userId: string): Promise<{ success: boolean }>{
        const user = await User.findOneBy({ id: userId });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
        }

        const { affected } = await User.delete({ id: userId });
        if((affected ?? 0) > 0){
            await this.#eventBus.emit('user.deleted', { userId });
        }

        return { success: true };
    }

    getOAuthProviders(): { providers: OAuthProvider[] }{
        return { providers: getConfiguredOAuthProviders() };
    }

    async updateAccount(
        userId: string,
        input: UpdateAccountInput,
        file?: Express.Multer.File
    ): Promise<WireUser & { fullName: string }>{
        const user = await User.findOneBy({ id: userId });
        if(!user){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'User not found');
        }

        let normalizedEmail: string | undefined;
        if(input.email){
            normalizedEmail = normalizeEmail(input.email);
        }

        if(normalizedEmail && normalizedEmail !== user.email){
            if(await this.#emailExists(normalizedEmail)){
                throw ApplicationError.conflict(ErrorCodes.AUTH_CREDENTIALS_INVALID, 'Email already registered');
            }
        }

        const updateData: Partial<User> = {};
        if(input.firstName){
            updateData.firstName = normalizeName(input.firstName);
        }
        if(input.lastName){
            updateData.lastName = normalizeName(input.lastName);
        }
        if(input.fullName){
            const normalizedFullName = splitFullName(input.fullName);
            updateData.firstName = normalizedFullName.firstName;
            updateData.lastName = normalizedFullName.lastName ?? user.lastName;
        }
        if(normalizedEmail){
            updateData.email = normalizedEmail;
        }
        if(file?.buffer){
            updateData.avatar = await this.#avatarService.uploadCustomAvatar(userId, file.buffer);
        }

        const updatedUser = await Object.assign(user, updateData).save();

        return this.#presentAccount(updatedUser);
    }

    async oauthLogin(input: OAuthLoginInput): Promise<AuthSessionResult>{
        let user = await User.findOneBy({
            oauthProvider: input.oauthProvider,
            oauthId: input.oauthId
        });

        if(!user){
            const existingByEmail = await User.findOneBy({ email: normalizeEmail(input.email) });

            if(existingByEmail){
                await User.update({ id: existingByEmail.id }, {
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    avatar: input.avatar || existingByEmail.avatar
                });
                user = existingByEmail;
            }else{
                const randomName = generateRandomName(input.oauthId);
                user = await User.create({
                    email: normalizeEmail(input.email),
                    firstName: normalizeName(input.firstName ?? randomName.firstName),
                    lastName: normalizeName(input.lastName ?? randomName.lastName),
                    oauthProvider: input.oauthProvider,
                    oauthId: input.oauthId,
                    teams: [],
                    analyses: []
                }).save();

                await this.#eventBus.emit('user.created', {
                    id: user.id,
                    firstName: user.firstName
                });

                try{
                    await this.#defaultTeamEnroller.enrollIfConfigured(user.id);
                }catch(err){
                    logger.error(err, '[OAuthLogin] default-team enrollment failed');
                }
            }
        }

        await this.#updateLastLogin(user.id);

        const token = await this.#authSessionService.createSessionWithToken({
            userId: user.id,
            ip: input.ip,
            userAgent: input.userAgent,
            activityType: SessionActivityType.OAuthLogin
        });

        return {
            user: this.#presentUser(user),
            token
        };
    }

    async #emailExists(email: string): Promise<boolean>{
        return User.existsBy({ email: normalizeEmail(email) });
    }

    async #updateLastLogin(userId: string): Promise<void>{
        const now = new Date();
        await User.update({ id: userId }, {
            lastLoginAt: now,
            lastSeenAt: now
        });
    }

    async #createFailedLogin(userId: string | null, userAgent: string, ip: string): Promise<void>{
        await Session.create({
            user: userId,
            token: null,
            userAgent,
            ip,
            isActive: false,
            lastActivity: new Date(),
            action: SessionActivityType.FailedLogin,
            success: false
        }).save();
    }

    #presentUser(user: User): WireUser{
        const view = user.toJSON();
        view.teams = user.teams ?? [];
        view.analyses = user.analyses ?? [];
        return view;
    }

    #presentAccount(user: User): WireUser & { fullName: string }{
        return {
            ...this.#presentUser(user),
            fullName: `${user.firstName} ${user.lastName}`.trim()
        };
    }
}
