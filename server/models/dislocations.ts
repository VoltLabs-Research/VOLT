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
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';

const BurgersSchema = new Schema({
    vector: {
        type: [Number],
        required: true
    },
    magnitude: {
        type: Number,
        required: true
    },
    fractional: {
        type: String,
        required: true
    }
}, { _id: false });

const LineDirectionSchema = new Schema({
    vector: [Number],
    string: String
}, { _id: false });

const NodesSchema = new Schema({
    forward: Schema.Types.Mixed,
    backward: Schema.Types.Mixed
}, { _id: false });

const DislocationDataSchema = new Schema({
    segmentId: {
        type: Number,
        required: true
    },
    type: {
        type: String,
    },
    numPoints: {
        type: Number,
        required: true
    },
    length: {
        type: Number,
        required: true
    },
    points: {
        type: [[Number]],
        required: true
    },
    burgers: {
        type: BurgersSchema,
        required: true
    },
    nodes: NodesSchema,
    lineDirection: LineDirectionSchema
}, { _id: false });

const DislocationSchema: Schema<any> = new Schema({
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        cascade: 'delete',
        inverse: { path: 'dislocations', behavior: 'addToSet' },
        required: true
    },
    timestep: {
        type: Number,
        required: true
    },
    totalSegments: {
        type: Number,
        required: true
    },
    analysisConfig: {
        type: Schema.Types.ObjectId,
        ref: 'AnalysisConfig',
    cascade: 'delete',
        inverse: { path: 'dislocations', behavior: 'addToSet' }
    },
    dislocations: [DislocationDataSchema],
    totalPoints: {
        type: Number,
        required: true
    },
    averageSegmentLength: {
        type: Number,
        required: true
    },
    maxSegmentLength: {
        type: Number,
        required: true
    },
    minSegmentLength: {
        type: Number,
        required: true
    },
    totalLength: {
        type: Number,
        required: true
    }
}, { timestamps: true });

/*DislocationSchema.index(
    { trajectory: 1, timestep: 1 },
    { unique: true }
);*/

DislocationSchema.plugin(useInverseRelations);
DislocationSchema.plugin(useCascadeDelete);

const Dislocation: Model<any> = mongoose.model<any>('Dislocation', DislocationSchema);

export default Dislocation;