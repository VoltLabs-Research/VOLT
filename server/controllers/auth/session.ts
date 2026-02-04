import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Session } from '@/models/index';
import { ISession } from '@/models/session';
import BaseController from '@/controllers/base-controller';
import { catchAsync } from '@/utilities/runtime/runtime';
import { Resource } from '@/constants/resources';

export default class SessionController extends BaseController<ISession> {
    constructor() {
        super(Session, {
            resource: Resource.SESSION,
            fields: ['isActive']
        });
    }

    /**
     * Users can only see their own active sessions
     */
    protected async getFilter(req: Request): Promise<FilterQuery<ISession>> {
        const userId = (req as any).user._id;
        return { user: userId, isActive: true };
    }

    /**
     * Get login activity history (includes all sessions, not just active)
     */
    public getMyLoginActivity = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const limit = parseInt(req.query.limit as string) || 20;

        const activities = await Session.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(limit);

        res.status(200).json({
            status: 'success',
            results: activities.length,
            data: activities
        });
    });

    /**
     * Revoke all sessions except current one
     */
    public revokeAllOtherSessions = catchAsync(async (req: Request, res: Response) => {
        const userId = (req as any).user._id;
        const currentToken = req.headers.authorization?.split(' ')[1];

        await Session.updateMany(
            { user: userId, token: { $ne: currentToken }, isActive: true },
            { isActive: false }
        );

        res.status(200).json({
            status: 'success',
            message: 'All other sessions have been revoked'
        });
    });
}
