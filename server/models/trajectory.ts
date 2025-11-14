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
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';

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
        required: true,
        cascade: 'delete',
        inverse: { path: 'trajectories', behavior: 'addToSet' }
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    structureAnalysis: [{
        type: Schema.Types.ObjectId,
        ref: 'StructureAnalysis',
        inverse: { path: 'trajectory', behavior: 'set' },
        cascade: 'pull'
    }],
    simulationCell: {
        type: Schema.Types.ObjectId,
        inverse: { path: 'trajectory', behavior: 'set' },
        ref: 'SimulationCell',
        cascade: 'unset'
    },
    dislocations: [{
        type: Schema.Types.ObjectId,
        ref: 'Dislocation',
        inverse: { path: 'trajectory', behavior: 'set' },
        cascade: 'pull'
    }],
    status: {
        type: String,
        lowercase: true,
        enum: ['queued', 'processing', 'rendering', 'completed', 'failed'],
        default: 'queued'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    analysis: [{
        type: Schema.Types.ObjectId,
        ref: 'AnalysisConfig',
        cascade: 'pull',
        inverse: { path: 'trajectory', behavior: 'set' },
        default: []
    }],
    frames: [TimestepInfoSchema],
    rasterSceneViews: {
        type: Number,
        default: 0
    },
    preview: {
        type: String,
        default: null
    },
    stats: {
        totalFiles: { type: Number, default: 0 },
        totalSize: { type: Number, default: 0 }
    },
    availableModels: {
        atomicStructure: { type: Boolean, default: false },
        dislocations: { type: Boolean, default: false },
        bonds: { type: Boolean, default: false },
        simulationCell: { type: Boolean, default: false },
        structureIdentification: { type: Boolean, default: false }
    }
}, {
    timestamps: true,
});

TrajectorySchema.plugin(useInverseRelations);
TrajectorySchema.plugin(useCascadeDelete);

// Calculate available models based on trajectory data
TrajectorySchema.post('findOne', function(doc) {
    if (doc) {
        const availableModels = {
            atomicStructure: doc.frames && doc.frames.length > 0,
            dislocations: doc.dislocations && doc.dislocations.length > 0,
            bonds: doc.frames && doc.frames.length > 0, // Bonds are part of frames
            simulationCell: !!doc.simulationCell,
            structureIdentification: doc.structureAnalysis && doc.structureAnalysis.length > 0
        };
        doc.availableModels = availableModels;
    }
});

TrajectorySchema.post('find', function(docs) {
    if (Array.isArray(docs)) {
        docs.forEach(doc => {
            const availableModels = {
                atomicStructure: doc.frames && doc.frames.length > 0,
                dislocations: doc.dislocations && doc.dislocations.length > 0,
                bonds: doc.frames && doc.frames.length > 0,
                simulationCell: !!doc.simulationCell,
                structureIdentification: doc.structureAnalysis && doc.structureAnalysis.length > 0
            };
            doc.availableModels = availableModels;
        });
    }
});

// Text index to enable full-text search (used by APIFeatures.search via HandlerFactory)
// Include name (primary) and status for flexible queries
TrajectorySchema.index({ name: 'text', status: 'text' });

TrajectorySchema.pre('findOneAndDelete', async function(next){
    const trajectoryToDelete = await this.model.findOne(this.getFilter());
    if(!trajectoryToDelete){
        return next();
    }

    const { folderId } = trajectoryToDelete;
    const trajectoryPath = join(process.env.TRAJECTORY_DIR as string, folderId);

    try{
        if(existsSync(trajectoryPath)){
            console.log('Removing trajectory directory:', trajectoryPath);
            await rm(trajectoryPath, { recursive: true });
        }

        next();
    }catch(error){
        next(error as Error);
    }
});

const Trajectory: Model<ITrajectory> = mongoose.model('Trajectory', TrajectorySchema);

export default Trajectory;