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
import { existsSync } from 'fs';
import { rm, writeFile, mkdir, readdir } from 'fs/promises';
import { join } from 'path';
import { Trajectory, Team } from '@/models/index';

export const processPreviewUpload = async (req: Request, res: Response, next: NextFunction) => {
    const file = req.file;
    const trajectory = res.locals.trajectory;

    if(!file){
        console.log('No file provided, continuing with normal update...');
        return next();
    }

    try{
        console.log('Processing preview upload for trajectory:', trajectory._id);
        
        const trajectoryPath = join(process.env.TRAJECTORY_DIR as string, trajectory.folderId);
        
        if(!existsSync(trajectoryPath)){
            await mkdir(trajectoryPath, { recursive: true });
        }

        console.log('Cleaning up old preview files...');
        try{
            const files = await readdir(trajectoryPath);
            const pngFiles = files.filter(file => file.endsWith('.png'));
            
            for(const pngFile of pngFiles){
                const oldFilePath = join(trajectoryPath, pngFile);
                console.log('Removing old preview file:', oldFilePath);
                await rm(oldFilePath);
            }
        }catch(cleanupError){
            console.warn('Error cleaning up old previews:', cleanupError);
        }

        const previewId = `preview_${trajectory._id.toString()}`;
        const fileName = `${previewId}.png`;
        const filePath = join(trajectoryPath, fileName);
        
        console.log('Saving new preview file to:', filePath);
        
        await writeFile(filePath, file.buffer);
        req.body.preview = previewId;
        
        console.log('Preview processed successfully, previewId:', previewId);
        
        next();
    }catch(error){
        console.error('Error processing preview upload:', error);
        return res.status(500).json({
            status: 'error',
            data: { error: 'Failed to process preview upload' }
        });
    }
};

export const processAndValidateUpload = async (req: Request, res: Response, next: NextFunction) => {
    const files = req.files as Express.Multer.File[];
    if(!files || files.length === 0) {
        return res.status(400).json({
            status: 'error',
            data: { error: 'No files uploaded' }
        });
    }

    const { teamId } = req.body;
    if(!teamId){
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
    const userId = (req as any).user.id;
    const trajectory = await Trajectory.findById(id);
    if(!trajectory){
        return res.status(404).json({
            status: 'error',
            data: { error: 'Trajectory not found' }
        });
    }

    const team = await Team.findOne({ _id: trajectory.team, members: userId });
    if(!team){
        return res.status(403).json({
            status: 'error',
            data: { error: 'Forbidden. Your do not have access to this trajectory.' }
        });
    }

    res.locals.trajectory = trajectory;
    res.locals.team = team;

    next();
};