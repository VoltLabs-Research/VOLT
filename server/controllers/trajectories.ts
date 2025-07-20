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

import { Request, Response } from 'express';
import { join, resolve } from 'path';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';
import Trajectory from '@models/trajectory';
import User from '@models/user';
import Team from '@models/team';
import HandlerFactory from '@controllers/handlerFactory';

const factory = new HandlerFactory({
    model: Trajectory,
    fields: ['name']
});

export const getAllTrajectories = factory.getAll();
export const getTrajectoryById = factory.getOne();
export const updateTrajectoryById = factory.updateOne();
export const deleteTrajectoryById = factory.deleteOne();

export const getTrajectoryGLTF = async (req: Request, res: Response) => {
    const { timestep }= req.params;
    const trajectory = res.locals.trajectory;

    const frame = trajectory.frames.find((frame: any) => frame.timestep.toString() === timestep);
    if(!frame){
        return res.status(404).json({
            status: 'error',
            data: { error: `Timestep ${timestep} not found in trajectory` }
        });
    }

    const basePath = resolve(process.cwd(), process.env.TRAJECTORY_DIR as string);

    const gltfFilePath = join(
        basePath,
        trajectory.folderId,
        'gltf',
        `${timestep}.gltf`
    );

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

export const createTrajectory = async (req: Request, res: Response) => {
    const { trajectoryData } = res.locals;
    const newTrajectory = await Trajectory.create(trajectoryData)

    res.status(201).json({ status: 'success', data: newTrajectory });
};

export const getUserTrajectories = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const userTeams = await Team.find({ members: userId }).select('_id');
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