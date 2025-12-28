/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { Session } from '@/models/index';
import { ISession } from '@/models/session';
import BaseController from '@/controllers/base-controller';
import { catchAsync } from '@/utilities/runtime/runtime';

export default class SessionController extends BaseController<ISession> {
    constructor() {
        super(Session, {
            resourceName: 'Session',
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
