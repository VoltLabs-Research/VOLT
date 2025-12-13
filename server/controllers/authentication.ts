import { Request, Response, NextFunction } from 'express';
import jwt, { Secret } from 'jsonwebtoken';
import BaseController from '@/controllers/base-controller';
import { User, Session } from '@/models';
import { IUser } from '@/types/models/user';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { AvatarService } from '@/services/avatar';
import { generateRandomName } from '@/utilities/runtime/name-generator';

export default class AuthController extends BaseController<IUser> {
    constructor(){
        super(User, {
            resourceName: 'User',
            fields: ['firstName', 'lastName', 'email', 'avatar']
        });
    }

    /**
     * Handle file uploads for avatar
     */
    protected async onBeforeUpdate(data: Partial<IUser>, req: Request): Promise<Partial<IUser>>{
        if(req.file){
            try{
                const avatarUrl = await AvatarService.uploadCustomAvatar(
                    (req as any).user._id.toString(),
                    req.file.buffer);
                data.avatar = avatarUrl;
            }catch(error){
                throw new RuntimeError(ErrorCodes.AUTHENTICATION_UPDATE_AVATAR_FAILED, 500);
            }
        }
        return data;
    }

    private signToken(id: string): string{
        const secret: Secret = process.env.SECRET_KEY as Secret;
        const raw = process.env.JWT_EXPIRATION_DAYS;
        const expiresIn = raw && /^\d+$/.test(raw) ? Number(raw) : (raw || '7d');
        return jwt.sign({ id }, secret, { expiresIn: expiresIn as any });
    }

    private async createAndSendToken(res: Response, statusCode: number, user: IUser, req: Request) {
        const token = this.signToken(String(user._id));
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        await Session.create({
            user: user._id,
            token,
            userAgent,
            ip,
            isActive: true,
            lastActivity: new Date(),
            action: 'login',
            success: true
        });

        // Remove sensitive data(user as any).password = undefined;
        (user as any).__v = undefined;

        res.status(statusCode).json({
            status: 'success',
            data: { token, user }
        });
    }

    public signUp = catchAsync(async(req: Request, res: Response) => {
        const { email, firstName, lastName, password } = req.body;
        const newUser = await User.create({ email, firstName, lastName, password });
        await this.createAndSendToken(res, 201, newUser, req);
    });

    public signIn = catchAsync(async(req: Request, res: Response) => {
        const { email, password } = req.body;
        if(!email || !password) throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_MISSING, 400);

        const user = await User.findOne({ email }).select('+password');
        if(!user || !(await user.isCorrectPassword(password, user.password!))) {
            await Session.create({
                user: user?._id || null,
                token: null,
                userAgent: req.get('User-Agent') || 'Unknown',
                ip: req.ip || 'Unknown',
                isActive: false,
                lastActivity: new Date(),
                action: 'failed_login',
                success: false,
                failureReason: !user ? 'User not found' : 'Invalid password'
            });
            throw new RuntimeError(ErrorCodes.AUTH_CREDENTIALS_INVALID, 401);
        }

        await this.createAndSendToken(res, 200, user, req);
    });

    public checkEmail = catchAsync(async(req: Request, res: Response) => {
        const { email } = req.body;
        const user = await User.findOne({ email });
        res.status(200).json({
            status: 'success',
            data: { exists: !!user }
        });
    });

    public oauthCallback = catchAsync(async(req: Request, res: Response) => {
        const user = req.user as IUser;
        const token = this.signToken(String(user._id));

        await Session.create({
            user: user._id,
            token,
            userAgent: req.get('User-Agent') || 'Unknown',
            ip: req.ip || 'Unknown',
            isActive: true,
            lastActivity: new Date(),
            action: 'oauth_login',
            success: true
        });

        const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/auth/oauth/success';
        res.redirect(`${frontendUrl}?token=${token}`);
    });

    public getGuestIdentity = catchAsync(async(req: Request, res: Response) => {
        const { seed } = req.query;
        if(!seed || typeof seed !== 'string') throw new RuntimeError(ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED, 400);

        const { firstName, lastName } = generateRandomName(seed);

        res.status(200).json({
            status: 'success',
            data: { firstName, lastName }
        });
    });

    public updatePassword = catchAsync(async(req: Request, res: Response) => {
        const user = (req as any).user as IUser;
        const userWithPwd = await User.findById(user.id).select('+password');
        if(!userWithPwd) throw new RuntimeError(ErrorCodes.USER_NOT_FOUND, 404);

        if(!(await userWithPwd.isCorrectPassword(req.body.passwordCurrent, userWithPwd.password!))) {
            throw new RuntimeError(ErrorCodes.AUTHENTICATION_UPDATE_PASSWORD_INCORRECT, 400);
        }

        userWithPwd.password = req.body.password;
        await userWithPwd.save();
        await this.createAndSendToken(res, 200, userWithPwd, req);
    });

    public aliasMe = (req: Request, res: Response, next: NextFunction) => {
        req.params.id = (req as any).user.id;
        next();
    };

    public getMyAccount = [this.aliasMe, this.getOne];
    public updateMyAccount = [this.aliasMe, this.updateOne];
    public deleteMyAccount = [this.aliasMe, this.deleteOne];
};
