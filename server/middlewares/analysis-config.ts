import { Request, Response, NextFunction } from 'express';
import { Analysis, Team, Trajectory } from '@/models/index';
import { ErrorCodes } from '@/constants/error-codes';

// TODO:
export const checkTeamMembership = async(
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { id } = req.params;
    const analysisConfig = await Analysis.findById(id).select('trajectory');

    if(!analysisConfig){
        return res.status(404).json({
            status: 'error',
            data: { error: ErrorCodes.ANALYSIS_NOT_FOUND }
        });
    }

    // If the trajectory is public, allow access without auth/membership
    const trajectory = await Trajectory.findById(analysisConfig.trajectory).select('team isPublic');
    if(!trajectory){
        return res.status(404).json({ status: 'error', data: { error: ErrorCodes.TRAJECTORY_FILE_NOT_FOUND } });
    }

    if((trajectory as any).isPublic){
        return next();
    }

    // Ensure the user belongs to the team that owns the trajectory
    const userId = (req as any).user?.id;
    if(!userId){
        return res.status(401).json({ status: 'error', data: { error: 'Unauthorized' } });
    }

    const team = await Team.findOne({ _id: trajectory.team, members: userId }).select('_id');
    if(!team){
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden' } });
    }

    next();
};
