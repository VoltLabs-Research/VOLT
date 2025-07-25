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

import { NextFunction, Request, Response } from 'express';
import { join, resolve } from 'path';
import { access, stat, readdir, mkdir, rmdir } from 'fs/promises';
import { constants } from 'fs';
import { isValidObjectId } from 'mongoose';
import { v4 } from 'uuid';
import { getTrajectoryProcessingQueue } from '@/queues';
import Trajectory from '@models/trajectory';
import Team from '@models/team';
import HandlerFactory from '@/controllers/handler-factory';
import { extractTimestepInfo, isValidLammpsFile } from '@/utilities/lammps';
import RuntimeError from '@/utilities/runtime-error';

const factory = new HandlerFactory({
    model: Trajectory,
    fields: ['name']
});

export const getAllTrajectories = factory.getAll();
export const getTrajectoryById = factory.getOne();
export const updateTrajectoryById = factory.updateOne();
export const deleteTrajectoryById = factory.deleteOne();

export const listTrajectoryGLTFFiles = async (req: Request, res: Response) => {
    const trajectory = res.locals.trajectory;

    if(!trajectory){
        return res.status(400).json({
            status: 'error',
            data: { error: 'Trajectory not found in context' },
        });  
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const gltfDir = join(basePath, trajectory.folderId, 'gltf');

    let files: string[];
    try{
        files = await readdir(gltfDir);
    }catch(err){
        return res.status(500).json({
            status: 'error',
            data: { error: 'Failed to read GLTF directory' },
        });
    }

    const typeMap: Record<string, string | null> = {
        atoms_colored_by_type: null,
        dislocations: null,
        defect_mesh: null,
        interface_mesh: null
    };

    for(const file of files){
        const match = file.match(/^frame_\d+_([a-zA-Z0-9_]+)\.gltf$/);
        if(match){
            const type= match[1];
            if(type in typeMap){
                typeMap[type] = join('gltf', file);
            }
        }
    }

    return res.status(200).json({
        status: 'success',
        data: typeMap
    })
};

export const getTrajectoryGLTF = async (req: Request, res: Response) => {
    const { timestep } = req.params;
    const { type } = req.query;
    const trajectory = res.locals.trajectory;

    const frame = trajectory.frames.find((frame: any) => frame.timestep.toString() === timestep);
    if(!frame){
        return res.status(404).json({
            status: 'error',
            data: { error: `Timestep ${timestep} not found in trajectory` }
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);
    const fileName = type
        ? `frame_${timestep}_${type}.gltf`
        : `${timestep}.gltf`;

    const gltfFilePath = join(basePath, trajectory.folderId, 'gltf', fileName);

    try{
        await access(gltfFilePath, constants.F_OK);
    }catch(error){
        return res.status(404).json({
            status: 'error',
            data: { error: `GLTF file for timestep ${timestep} not found` }
        });
    }

    const fileStats = await stat(gltfFilePath);
    res.setHeader('Content-Type', 'model/gltf+json');
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Content-Disposition', `inline; filename="${trajectory.name}_${timestep}.gltf"`);
    // res.setHeader('Cache-Control', 'public, max-age=86400'); 

    res.sendFile(gltfFilePath);
};

export const createTrajectory = async (req: Request, res: Response, next: NextFunction) => {
    const { files, teamId } = res.locals.data;

    const folderId = v4();
    const folderPath = join(process.env.TRAJECTORY_DIR as string, folderId);
    const gltfFolderPath = join(folderPath, 'gltf');

    await mkdir(folderPath, { recursive: true });
    await mkdir(gltfFolderPath, { recursive: true });

    const validFiles = [];
    const frames = [];

    for(const file of files){
        const content = file.buffer.toString('utf-8');
        const lines = content.split('\n');
        const frameInfo = extractTimestepInfo(lines);
        const isValid = isValidLammpsFile(lines);

        if(!frameInfo || !isValid){
            continue;
        }

        const frameData = {
            ...frameInfo,
            gltfPath: `gltf/${frameInfo.timestep}.gltf`
        };

        frames.push(frameData);
        validFiles.push({
            frameData,
            file
        });
    }

    if(validFiles.length === 0){
        await rmdir(folderPath);
        return next(new RuntimeError('No valid files for trajectory', 400));
    }

    const newTrajectory = await Trajectory.create({
        folderId,
        name: 'Untitled Trajectory',
        team: teamId,
        frames,
        status: 'processing',
        stats: {
            totalFiles: validFiles.length,
            totalSize: files.reduce((acc: number, file: Express.Multer.File) => acc + file.size, 0)
        }
    });

    const trajectoryProcessingQueue = getTrajectoryProcessingQueue();
    trajectoryProcessingQueue.addJobs([{
        jobId: v4(),
        trajectoryId: newTrajectory._id,
        files: validFiles.map(({ file, frameData }) => ({
            file: file.buffer.toJSON(),
            frameData
        })),
        folderPath,
        gltfFolderPath
    }]);

    res.status(201).json({ status: 'success', data: newTrajectory });
};

export const getUserTrajectories = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const { teamId } = req.query;
    
    let teamQuery: any = { members: userId };
    if(teamId && typeof teamId === 'string'){
        if(!isValidObjectId(teamId)){
            return res.status(400).json({
                status: 'error',
                data: { error: `The provided teamId '${teamId}' is not a valid ID.` }
            });
        }
        teamQuery._id = teamId;
    }

    const userTeams = await Team.find(teamQuery).select('_id');
    if(teamId && userTeams.length === 0){
        return res.status(200).json({ status: 'success', data: [] });
    }
    
    const teamIds = userTeams.map((team) => team._id);

    const trajectories = await Trajectory.find({ team: { $in: teamIds } })
        .populate({
            path: 'team',
            select: 'name owner members',
            populate: {
                path: 'owner members',
                select: 'firstName lastName email'
            }
        })
        .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: trajectories });
};