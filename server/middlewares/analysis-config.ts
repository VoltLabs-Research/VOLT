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
import { AnalysisConfig, Team, Trajectory } from '@/models/index';

// TODO:
export const checkTeamMembershipForAnalysisTrajectory = async (
    req: Request, 
    res: Response, 
    next: NextFunction
) => {
    const { id } = req.params;
    const analysisConfig = await AnalysisConfig.findById(id).select('trajectory');

    if(!analysisConfig){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Analysis config not found' }
        });
    }

    // If the trajectory is public, allow access without auth/membership
    const trajectory = await Trajectory.findById(analysisConfig.trajectory).select('team isPublic');
    if(!trajectory){
        return res.status(404).json({ status: 'error', data: { error: 'Trajectory not found' } });
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