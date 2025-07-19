import { Request, Response } from 'express';
import Trajectory from '@models/trajectory';
import User from '@models/user';

export const createTrajectory = async (req: Request, res: Response) => {
    const { trajectoryData } = res.locals;
    const newTrajectory = await Trajectory.create(trajectoryData)

    await User.findByIdAndUpdate(trajectoryData.owner, 
        { $push: { trajectories: newTrajectory._id } });
    
    res.status(201).json({ status: 'success', data: newTrajectory });
};

export const getUserTrajectories = async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const user = await User.findById(userId).populate({
        path: 'trajectories',
        populate: {
            path: 'owner sharedWith',
            select: 'firstName lastName email'
        }
    });

    if(!user){
        return res.status(404).json({ status: 'error', data: { error: 'User not found' } });
    }

    res.status(200).json({ status: 'success', data: user.trajectories });
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