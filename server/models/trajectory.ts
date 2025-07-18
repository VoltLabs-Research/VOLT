import mongoose, { Schema, Model, Document } from 'mongoose';
import { rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { NextFunction } from 'express';
import { ITrajectory } from '@types/models/trajectory';
import User from '@models/user';

const TrajectorySchema: Schema<ITrajectory> = new Schema({
    name: {
        type: String,
        required: [true, 'Trajectory::Name::Required'],
        minlength: [4, 'Trajectory::Name::MinLength'],
        maxlength: [32, 'Trajectory::Name::MaxLength'],
        trim: true
    },
    folderId: {
        type: String,
        required: true,
        unique: true
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sharedWith: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

TrajectorySchema.virtual('users').get(function(){
    return [this.owner, ...this.sharedWith];
});

TrajectorySchema.pre('findOneAndDelete', async function(next: NextFunction){
    const trajectoryToDelete = await this.model.findOne(this.getFilter());
    if(!trajectoryToDelete){
        return next();
    }

    const { _id, folderId, users } = trajectoryToDelete;
    const trajectoryPath = join(process.env.TRAJECTORY_DIR as string, folderId);
    const analysisPath = join(process.env.ANALYSIS_DIR as string, folderId);

    try{
        if(existsSync(trajectoryPath)){
            await rmdir(trajectoryPath, { recursive: true });
        }

        if(existsSync(analysisPath)){
            await rmdir(analysisPath, { recursive: true });
        }

        await User.updateMany(
            { _id: { $in: users } },
            { $pull: { trajectories: _id } }
        );

        next();
    }catch(error){
        console.error('Error during trajectory cascade delete:', error);
        next(error as Error);
    }
});

const Trajectory: Model<ITrajectory> = mongoose.model('Trajectory', TrajectorySchema);

export default Trajectory;