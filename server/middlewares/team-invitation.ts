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
import { TeamInvitation, Team } from '@/models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';

export const loadInvitationByToken = async(req: Request, res: Response, next: NextFunction) => {
    const { token } = req.params;

    if(!token){
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_TOKEN_REQUIRED, 400));
    }

    try{
        const invitation = await TeamInvitation.findOne({ token });

        if(!invitation){
            return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 404));
        }

        if(invitation.status !== 'pending'){
            return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_ALREADY_PROCESSED, 400));
        }

        if(new Date() > invitation.expiresAt) {
            return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_EXPIRED, 400));
        }

        res.locals.invitation = invitation;
        next();
    }catch(err: any){
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 500));
    }
};

export const verifyInvitationRecipient = (req: Request, res: Response, next: NextFunction) => {
    const invitation = res.locals.invitation;
    const userId = (req as any).user?._id;

    if(!invitation){
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_NOT_FOUND, 404));
    }

    if(invitation.invitedUser?.toString() !== userId?.toString()) {
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_UNAUTHORIZED, 403));
    }

    next();
};

export const verifyTeamOwnership = async(req: Request, res: Response, next: NextFunction) => {
    const { teamId } = req.params;
    const userId = (req as any).user?._id;

    if(!teamId){
        return next(new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400));
    }

    try{
        const team = await Team.findById(teamId);

        if(!team){
            return next(new RuntimeError(ErrorCodes.TEAM_NOT_FOUND, 404));
        }

        if(team.owner.toString() !== userId?.toString()) {
            return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_OWNER_ONLY, 403));
        }

        res.locals.team = team;
        next();
    }catch(err: any){
        return next(new RuntimeError(ErrorCodes.TEAM_LOAD_ERROR, 500));
    }
};

export const validateInvitationBody = (req: Request, res: Response, next: NextFunction) => {
    const { email, role } = req.body;

    if(!email || !role){
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_EMAIL_ROLE_REQUIRED, 400));
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!emailRegex.test(email.toLowerCase())) {
        return next(new RuntimeError(ErrorCodes.TEAM_INVITATION_INVALID_EMAIL, 400));
    }

    next();
};
