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

import { Request, Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export const POPULATE_FIELDS = {
    user: 'firstName lastName email',
    userFull: 'firstName lastName email avatar',
    team: 'name description',
    teamWithMembers: 'name description members owner'
} as const;

export const CHAT_POPULATES = [
    { path: 'participants', select: POPULATE_FIELDS.user },
    { path: 'admins', select: POPULATE_FIELDS.user },
    { path: 'createdBy', select: POPULATE_FIELDS.user },
    { path: 'lastMessage' },
    { path: 'team', select: 'name' }
] as const;

export const populateChatDoc = async <T extends { populate: (path: string, select?: string) => Promise<T> }>(doc: T): Promise<T> => {
    await doc.populate('participants', POPULATE_FIELDS.user);
    await doc.populate('admins', POPULATE_FIELDS.user);
    await doc.populate('createdBy', POPULATE_FIELDS.user);
    await doc.populate('team', 'name');
    return doc;
};

/**
 * Middleware to verify team membership by teamId in query or body
 */
export const verifyTeamMembershipByTeamId = async (req: Request, res: Response, next: NextFunction) => {
    const teamId = req.body.teamId || req.query.teamId || req.params.teamId;
    const userId = (req as any).user?._id || (req as any).user?.id;

    if (!userId) {
        return next(new RuntimeError(ErrorCodes.AUTH_UNAUTHORIZED, 401));
    }

    if (!teamId) {
        return next(new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400));
    }

    if (!isValidObjectId(teamId)) {
        return next(new RuntimeError(ErrorCodes.VALIDATION_INVALID_TEAM_ID, 400));
    }

    try {
        const team = await Team.findOne({ _id: teamId, members: userId });

        if (!team) {
            return next(new RuntimeError(ErrorCodes.TEAM_ACCESS_DENIED, 403));
        }

        res.locals.team = team;
        next();
    } catch (err: any) {
        return next(new RuntimeError(ErrorCodes.TEAM_LOAD_ERROR, 500));
    }
};
