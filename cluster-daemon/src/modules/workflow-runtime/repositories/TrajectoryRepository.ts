import { TrajectoryModel, type TrajectoryDocument } from '../models';

export const findTrajectoryById = async (trajectoryId: string): Promise<TrajectoryDocument | null> => {
    return TrajectoryModel.findById(trajectoryId).lean<TrajectoryDocument | null>().exec();
};

export type TrajectoryRepository = {
    findById: typeof findTrajectoryById;
};

export const trajectoryRepository: TrajectoryRepository = {
    findById: findTrajectoryById
};
