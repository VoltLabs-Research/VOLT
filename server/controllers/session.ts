/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
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
**/

import { Request, Response, NextFunction } from 'express';
import { Session } from '@/models/index';
import RuntimeError from '@/utilities/runtime-error';

/**
 * Get all active sessions for the authenticated user
 */
export const getMySessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user._id;
        
        const sessions = await Session.find({ 
            user: userId, 
            isActive: true 
        }).sort({ lastActivity: -1 });

        res.status(200).json({
            status: 'success',
            results: sessions.length,
            data: sessions
        });
    } catch (error) {
        next(new RuntimeError('Session::GetSessions::Failed', 500));
    }
};

/**
 * Get login activity for the authenticated user
 */
export const getMyLoginActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
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
    } catch (error) {
        next(new RuntimeError('Session::GetLoginActivity::Failed', 500));
    }
};

/**
 * Revoke a specific session
 */
export const revokeSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user._id;
        const sessionId = req.params.id;

        const session = await Session.findOneAndUpdate(
            { _id: sessionId, user: userId },
            { isActive: false },
            { new: true }
        );

        if (!session) {
            return next(new RuntimeError('Session::NotFound', 404));
        }

        res.status(200).json({
            status: 'success',
            data: session
        });
    } catch (error) {
        next(new RuntimeError('Session::RevokeSession::Failed', 500));
    }
};

/**
 * Revoke all other sessions (keep current one)
 */
export const revokeAllOtherSessions = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user._id;
        const currentToken = req.headers.authorization?.split(' ')[1];

        await Session.updateMany(
            { 
                user: userId, 
                token: { $ne: currentToken },
                isActive: true 
            },
            { isActive: false }
        );

        res.status(200).json({
            status: 'success',
            message: 'All other sessions have been revoked'
        });
    } catch (error) {
        next(new RuntimeError('Session::RevokeAllOtherSessions::Failed', 500));
    }
};
