import { Request, Response, NextFunction } from 'express';
import { Team } from '@models/index';
import RuntimeError from '@/utilities/runtime/runtime-error';
import { ErrorCodes } from '@/constants/error-codes';
import { Types } from 'mongoose';

export const checkTeamMembership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const teamIdParam = req.params.teamId || req.params.id;
    if (!teamIdParam || !Types.ObjectId.isValid(teamIdParam)) {
        return next(new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400));
    }

    const teamId = new Types.ObjectId(teamIdParam);
    const userId = (req as any).user._id;

    const team = await Team.findOne({ _id: teamId, members: userId });

    if (!team) {
        return next(new RuntimeError(ErrorCodes.TEAM_MEMBERSHIP_FORBIDDEN, 403));
    }

    res.locals.team = team;
    req.params.teamId = teamIdParam;

    next();
};

export const checkTeamOwnership = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const teamIdParam = req.params.id || req.params.teamId;
    if (!teamIdParam || !Types.ObjectId.isValid(teamIdParam)) {
        return next(new RuntimeError(ErrorCodes.TEAM_ID_REQUIRED, 400));
    }

    const userId = (req as any).user._id;

    const team = await Team.findOne({ _id: teamIdParam, owner: userId });

    if (!team) {
        return next(new RuntimeError(ErrorCodes.TEAM_OWNERSHIP_FORBIDDEN, 403));
    }

    res.locals.team = team;
    req.params.teamId = teamIdParam;

    next();
};
