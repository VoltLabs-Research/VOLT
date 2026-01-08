
import { Request, Response, NextFunction } from 'express';
import BaseController from '@/controllers/base-controller';
import { User } from '@/models';
import { IUser } from '@/types/models/user';
import { catchAsync } from '@/utilities/runtime/runtime';
import { ErrorCodes } from '@/constants/error-codes';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { Resource } from '@/constants/resources';
import authService from '@/services/authentication';

export default class AuthController extends BaseController<IUser> {
    constructor() {
        super(User, {
            resource: Resource.AUTH,
            fields: ['firstName', 'lastName', 'email', 'avatar']
        });
    }

    /**
     * Handle file uploads for avatar
     */
    protected async onBeforeUpdate(data: Partial<IUser>, req: Request): Promise<Partial<IUser>> {
        if (req.file) {
            try {
                const userId = (req as any).user._id.toString();
                const avatarUrl = await authService.updateAvatar(userId, req.file.buffer);
                data.avatar = avatarUrl;
            } catch (error) {
                throw new RuntimeError(ErrorCodes.AUTHENTICATION_UPDATE_AVATAR_FAILED, 500);
            }
        }
        return data;
    }

    public signUp = catchAsync(async (req: Request, res: Response) => {
        const { email, firstName, lastName, password } = req.body;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        const result = await authService.signUp({ email, firstName, lastName, password }, userAgent, ip);
        res.status(201).json({ status: 'success', data: result });
    });

    public signIn = catchAsync(async (req: Request, res: Response) => {
        const { email, password } = req.body;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        const result = await authService.signIn(email, password, userAgent, ip);
        res.status(200).json({ status: 'success', data: result });
    });

    public checkEmail = catchAsync(async (req: Request, res: Response) => {
        const { email } = req.body;
        const exists = await authService.checkEmail(email);
        res.status(200).json({ status: 'success', data: { exists } });
    });

    public oauthCallback = catchAsync(async (req: Request, res: Response) => {
        const user = req.user as IUser;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        const token = await authService.oauthLogin(user, userAgent, ip);

        const frontendUrl = process.env.OAUTH_SUCCESS_REDIRECT || 'http://localhost:3000/auth/oauth/success';
        res.redirect(`${frontendUrl}?token=${token}`);
    });

    public getGuestIdentity = catchAsync(async (req: Request, res: Response) => {
        const { seed } = req.query;
        if (!seed || typeof seed !== 'string') throw new RuntimeError(ErrorCodes.AUTHENTICATION_GUEST_SEED_REQUIRED, 400);

        const identity = await authService.getGuestIdentity(seed);
        res.status(200).json({ status: 'success', data: identity });
    });

    public updatePassword = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user as IUser;
        const userAgent = req.get('User-Agent') || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        const result = await authService.updatePassword(user, req.body.passwordCurrent, req.body.password, userAgent, ip);
        res.status(200).json({ status: 'success', data: result });
    });

    public getPasswordInfo = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user as IUser;
        const info = await authService.getPasswordInfo(String(user._id));
        res.status(200).json({ status: 'success', data: info });
    });

    public changePassword = catchAsync(async (req: Request, res: Response) => {
        const user = (req as any).user as IUser;
        await authService.changePassword(String(user._id), req.body);
        res.status(200).json({ status: 'success', message: 'Password changed successfully' });
    });

    public aliasMe = (req: Request, res: Response, next: NextFunction) => {
        req.params.id = (req as any).user.id;
        next();
    };

    public getMyAccount = [this.aliasMe, this.getOne];
    public updateMyAccount = [this.aliasMe, this.updateOne];
    public deleteMyAccount = [this.aliasMe, this.deleteOne];
}
