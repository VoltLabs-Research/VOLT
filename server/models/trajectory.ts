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

import mongoose, { Schema, Model } from 'mongoose';
import { rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
// @ts-ignore
import type { ITrajectory, ITimestepInfo } from '@types/models/trajectory';
import Team from '@models/team';
import StructureAnalysis from '@/models/structure-analysis';
import SimulationCell from '@/models/simulation-cell';
import Dislocations from '@/models/dislocations';

const TimestepInfoSchema: Schema<ITimestepInfo> = new Schema({
    timestep: { type: Number, required: true },
    natoms: { type: Number, required: true },
    glbPath: { type: String, required: true },
    boxBounds: {
        xlo: { type: Number, required: true },
        xhi: { type: Number, required: true },
        ylo: { type: Number, required: true },
        yhi: { type: Number, required: true },
        zlo: { type: Number, required: true },
        zhi: { type: Number, required: true },
    }
}, { _id: false });

const TrajectorySchema: Schema<ITrajectory> = new Schema({
    name: {
        type: String,
        required: [true, 'Trajectory::Name::Required'],
        minlength: [4, 'Trajectory::Name::MinLength'],
        maxlength: [64, 'Trajectory::Name::MaxLength'],
        trim: true
    },
    folderId: {
        type: String,
        required: true,
        unique: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    structureAnalysis: [{
        type: Schema.Types.ObjectId,
        ref: 'StructureAnalysis'
    }],
    simulationCell: {
        type: Schema.Types.ObjectId,
        ref: 'SimulationCell'
    },
    dislocations: [{
        type: Schema.Types.ObjectId,
        ref: 'Dislocation'
    }],
    status: {
        type: String,
        lowercase: true,
        enum: ['processing', 'ready'],
        default: 'processing'
    },
    frames: [TimestepInfoSchema],
    preview: {
        type: String,
        default: null
    },
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
});

TrajectorySchema.pre('findOneAndDelete', async function(next){
    const trajectoryToDelete = await this.model.findOne(this.getFilter());
    if(!trajectoryToDelete){
        return next();
    }

    const { _id, folderId, team, preview } = trajectoryToDelete;
    const trajectoryPath = join(process.env.TRAJECTORY_DIR as string, folderId);

    try{
        if(existsSync(trajectoryPath)){
            console.log('Removing trajectory directory:', trajectoryPath);
            await rm(trajectoryPath, { recursive: true });
        }

        await StructureAnalysis.deleteMany({ trajectory: _id });
        await SimulationCell.deleteMany({ trajectory: _id });
        await Dislocations.deleteMany({ trajectory: _id });

        await Team.updateOne(
            { _id: team },
            { $pull: { trajectories: _id } }
        );

        console.log('Trajectory and all related data cleaned up successfully');
        next();
    }catch(error){
        console.error('❌ Error during trajectory cascade delete:', error);
        next(error as Error);
    }
});
TrajectorySchema.post('save', async function(doc, next){
    await Team.findByIdAndUpdate(doc.team, {
        $addToSet: { trajectories: doc._id }
    });
    next();
});

const Trajectory: Model<ITrajectory> = mongoose.model('Trajectory', TrajectorySchema);

export default Trajectory;