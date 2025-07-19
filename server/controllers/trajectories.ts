import { Request, Response } from 'express';
import { join } from 'path';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';
import Trajectory from '@models/trajectory';
import User from '@models/user';

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

    const gltfFilePath = join(
        process.env.TRAJECTORY_DIR as string,
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

// TODO: implement the HandlerFactory class
export const updateTrajectoryById = async (req: Request, res: Response) => {
    const { trajectoryId } = req.params;
    const { name } = req.body;
    const updateData: { name?: string; } = {};
    if(name){
        updateData.name = name;
    }

    const updatedTrajectory = await Trajectory.findByIdAndUpdate(
        trajectoryId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).populate('owner sharedWith', 'firstName lastName email');

    res.status(200).json({ status: 'success', data: updatedTrajectory });
};

export const getUserTrajectories = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;

    const trajectories = await Trajectory.find({ owner: userId })
        .populate('owner sharedWith', 'firstName lastName email')
        .sort({ createdAt: -1 });

    res.status(200).json({ status: 'success', data: trajectories });
};

export const getTrajectoryById = async (req: Request, res: Response) => {
    const { trajectoryId } = req.params;
    const trajectory = await Trajectory.findById(trajectoryId).populate('owner sharedWith', 'firstName lastName email');
    if(!trajectory){
        return res.status(404).json({ status: 'error', message: 'Trajectory not found' });
    }

    res.status(200).json({ status: 'success', data: trajectory });
};

export const deleteTrajectoryById = async (req: Request, res: Response) => {
    const { trajectoryId } = req.params;
    await Trajectory.findOneAndDelete({ _id: trajectoryId });
    res.status(204).json({ status: 'success', data: null });
}

export const shareTrajectoryWithUser = async (req: Request, res: Response) => {
    const { trajectory } = res.locals;
    const { emailToShareWith } = req.body;

    const userToShareWith = await User.findOne({ email: emailToShareWith });
    if(!userToShareWith){
        return res.status(404).json({ status: 'error', data: { error: `User with email ${emailToShareWith} not found` } });
    }

    if(trajectory.users.includes(userToShareWith._id)){
        return res.status(400).json({ status: 'error', data: { error: 'Trajectory already shared with this user' } });
    }

    await Trajectory.findByIdAndUpdate(trajectory._id, { $push: { sharedWith: userToShareWith._id } });
    await User.findByIdAndUpdate(userToShareWith._id, { $push: { trajectories: trajectory._id } });

    res.status(200).json({ status: 'success', data: null });
};