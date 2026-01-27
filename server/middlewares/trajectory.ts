/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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
