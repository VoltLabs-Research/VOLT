import { Request, Response, NextFunction } from 'express';
import { Trajectory, Team } from '@/models/index';
import multer, { FileFilterCallback } from 'multer';

import path from 'path';
import tempFileManager from '@/services/temp-file-manager';

export const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const dest = tempFileManager.rootPath;
            cb(null, dest);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix);
        }
    }),
    fileFilter: (req, file, cb: FileFilterCallback) => {
        cb(null, true);
    }
});

// Strict variant for write operations: always require team membership, regardless of public status
export const requireTeamMembershipForTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params as any;
    const userId = (req as any).user?.id;
    const trajectory = await Trajectory.findById(id);
    if (!trajectory) {
        return res.status(404).json({ status: 'error', data: { error: 'Trajectory not found' } });
    }
    if (!userId) {
        return res.status(401).json({ status: 'error', data: { error: 'Authentication required' } });
    }
    const team = await Team.findOne({ _id: trajectory.team, members: userId });
    if (!team) {
        return res.status(403).json({ status: 'error', data: { error: 'Forbidden. You do not have access to modify this trajectory.' } });
    }
    res.locals.trajectory = trajectory;
    res.locals.team = team;
    next();
};

export const processAndValidateUpload = async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'No files uploaded' }
        });
    }

    const { teamId } = req.body;
    if (!teamId) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'A teamId is required to create a trajectory' }
        });
    }

    res.locals.data = {
        teamId,
        files
    };

    next();
};

export const checkTeamMembershipForTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const trajectory = await Trajectory.findById(id);
    if (!trajectory) {
        return res.status(404).json({
            status: 'error',
            data: { error: 'Trajectory not found' }
        });
    }

    if (trajectory.isPublic) {
        res.locals.trajectory = trajectory;
        res.locals.isPublicAccess = true;
        return next();
    }

    const userId = (req as any).user?.id;
    if (!userId) {
        return res.status(401).json({
            status: 'error',
            data: { error: 'Authentication required to access private trajectory' }
        });
    }

    const team = await Team.findOne({ _id: trajectory.team, members: userId });
    if (!team) {
        return res.status(403).json({
            status: 'error',
            data: { error: 'Forbidden. Your do not have access to this trajectory.' }
        });
    }

    res.locals.trajectory = trajectory;
    res.locals.team = team;

    next();
};
