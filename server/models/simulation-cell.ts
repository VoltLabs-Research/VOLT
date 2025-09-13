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
import { ICellAnalysis } from '@/types/models/simulation-cell';
import { Trajectory, AnalysisConfig } from '@/models/index';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';

const PeriodicBoundarySchema = new Schema({
    x: { type: Boolean, required: true },
    y: { type: Boolean, required: true },
    z: { type: Boolean, required: true }
}, { _id: false });

const LatticeAnglesSchema = new Schema({
    alpha: { type: Number, required: true },
    beta: { type: Number, required: true },
    gamma: { type: Number, required: true }
}, { _id: false });

const ReciprocalLatticeSchema = new Schema({
    matrix: { type: [[Number]], required: true },
    volume: { type: Number, required: true }
}, { _id: false });

const DimensionalitySchema = new Schema({
    is_2d: { type: Boolean, required: true },
    effective_dimensions: { type: Number, required: true }
}, { _id: false });

const SimulationCellSchema: Schema<ICellAnalysis> = new Schema({
    matrix: {
        type: [[Number]],
        required: true
    },
    volume: {
        type: Number,
        required: true
    },
    periodicBoundaryConditions: {
        type: PeriodicBoundarySchema,
        required: true
    },
    angles: {
        type: LatticeAnglesSchema,
        required: true
    },
    analysisConfig: {
        type: Schema.Types.ObjectId,
        ref: 'AnalysisConfig',
        inverse: { path: 'simulationCell', behavior: 'set' },
        cascade: 'unset'
    },
    reciprocalLattice: {
        type: ReciprocalLatticeSchema,
        required: true
    },
    dimensionality: {
        type: DimensionalitySchema,
        required: true
    },
    timestep: {
        type: Number,
        required: true
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        cascade: 'delete',
        inverse: { path: 'simulationCell', behavior: 'set' },
        required: true
    }
}, {
    timestamps: true
});

SimulationCellSchema.plugin(useInverseRelations);
SimulationCellSchema.plugin(useCascadeDelete);

const SimulationCell: Model<ICellAnalysis> = mongoose.model<ICellAnalysis>('SimulationCell', SimulationCellSchema);

export default SimulationCell;