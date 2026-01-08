
import jwt, { Secret } from 'jsonwebtoken';
import { User, Session } from '@/models';
import { IUser } from '@/types/models/user';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { AvatarService } from '@/services/user/avatar';
import { generateRandomName } from '@/utilities/runtime/name-generator';

export class AuthenticationService {
    /**
     * handle avatar upload
     */
    async updateAvatar(userId: string, fileBuffer: Buffer): Promise<string> {
        return AvatarService.uploadCustomAvatar(userId, fileBuffer);
    }

    /**
     * Sign JWT token
     */
    signToken(id: string): string {
        const secret: Secret = process.env.SECRET_KEY as Secret;
        const raw = process.env.JWT_EXPIRATION_DAYS;
        const expiresIn = raw && /^\d+$/.test(raw) ? Number(raw) : (raw || '7d');
        return jwt.sign({ id }, secret, { expiresIn: expiresIn as any });
    }

    /**
     * Create session and return token/user data
     */
    async createSession(user: IUser, userAgent: string, ip: string, action: string = 'login') {
        const token = this.signToken(String(user._id));

        await Session.create({
            user: user._id,
            token,
            userAgent,
            ip,
            isActive: true,
            lastActivity: new Date(),
            action,
            success: true
        });

        // Prepare user object for response (remove sensitive data)
        const userObj = user.toObject ? user.toObject() : user;
        delete (userObj as any).__v;
        delete (userObj as any).password;

        return { token, user: userObj };
    }

    async signUp(userData: Partial<IUser>, userAgent: string, ip: string) {
        const newUser = await User.create(userData);
        return this.createSession(newUser, userAgent, ip, 'login');
    }

    async signIn(email: string, password: string, userAgent: string, ip: string) {
        if (!email || !password) throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_MISSING, 400);

        const user = await User.findOne({ email }).select('+password');

        if (!user || !(await user.isCorrectPassword(password, user.password!))) {
            await Session.create({
                user: user?._id || null,
                token: null,
                userAgent,
                ip,
                isActive: false,
                lastActivity: new Date(),
                action: 'failed_login',
                success: false,
                failureReason: !user ? 'User not found' : 'Invalid password'
            });
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_INVALID, 401);
        }

        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
        return this.createSession(user, userAgent, ip, 'login');
    }

    async checkEmail(email: string) {
        const user = await User.findOne({ email });
        return !!user;
    }

    async oauthLogin(user: IUser, userAgent: string, ip: string) {
        await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
        const sessionIdx = await this.createSession(user, userAgent, ip, 'oauth_login');
        return sessionIdx.token;
    }

    async getGuestIdentity(seed: string) {
        if (!seed) throw new RuntimeError(ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED, 400);
        return generateRandomName(seed);
    }

    async updatePassword(user: IUser, currentPassword: string, newPassword: string, userAgent: string, ip: string) {
        const userWithPwd = await User.findById(user._id).select('+password');
        if (!userWithPwd) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if (!(await userWithPwd.isCorrectPassword(currentPassword, userWithPwd.password!))) {
            throw new RuntimeError(ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT, 400);
        }

        userWithPwd.password = newPassword;
        await userWithPwd.save();

        return this.createSession(userWithPwd, userAgent, ip, 'password_update');
    }

    async changePassword(userId: string, { currentPassword, newPassword, confirmPassword }: any) {
        if (!currentPassword || !newPassword || !confirmPassword) {
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_MISSING, 400);
        }

        if (newPassword !== confirmPassword) {
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_INVALID, 400);
        }

        if (newPassword.length < 8) {
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_INVALID, 400);
        }

        const userWithPwd = await User.findById(userId).select('+password');
        if (!userWithPwd) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if (!(await userWithPwd.isCorrectPassword(currentPassword, userWithPwd.password!))) {
            throw new RuntimeError(ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT, 400);
        }

        if (await userWithPwd.isCorrectPassword(newPassword, userWithPwd.password!)) {
            // New password can't be the same as old one
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_INVALID, 400);
        }

        userWithPwd.password = newPassword;
        await userWithPwd.save();
    }

    async getPasswordInfo(userId: string) {
        const userWithPwd = await User.findById(userId).select('passwordChangedAt createdAt');
        if (!userWithPwd) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        return {
            lastChanged: userWithPwd.passwordChangedAt || userWithPwd.createdAt || new Date(),
            hasPassword: true
        };
    }
}

export default new AuthenticationService();
