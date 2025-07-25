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
// @ts-ignore
import { IStructureAnalysis, IStructureTypeStat } from '@/types/models/structure-analysis';
import Trajectory from '@models/trajectory';

const StructureTypeStatSchema = new Schema<IStructureTypeStat>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    count: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true
    },
    typeId: {
        type: Number,
        required: true
    }
}, { _id: false });

const StructureAnalysisSchema: Schema<IStructureAnalysis> = new Schema({
    totalAtoms: {
        type: Number,
        required: true
    },
    timestep: {
        type: Number,
        required: true,
    },
    analysisMethod: {
        type: String,
        required: true,
        enum: ['PTM', 'CNA']
    },
    types: {
        type: [StructureTypeStatSchema],
        required: true
    },
    identifiedStructures: {
        type: Number,
        required: true
    },
    unidentifiedStructures: {
        type: Number,
        required: true
    },
    identificationRate: {
        type: Number,
        required: true
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true
    }
}, {
    timestamps: true
});

StructureAnalysisSchema.index({ trajectory: 1, timestep: 1, analysisMethod: 1 }, { unique: true });

StructureAnalysisSchema.post('save', async function(doc, next){
    await Trajectory.findByIdAndUpdate(doc.trajectory, {
        $addToSet: { structureAnalysis: doc._id }
    });
    next();
});

const StructureAnalysis: Model<IStructureAnalysis> = mongoose.model<IStructureAnalysis>('StructureAnalysis', StructureAnalysisSchema);

export default StructureAnalysis;