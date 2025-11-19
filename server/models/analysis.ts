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

import mongoose, { Schema, Model, Document } from 'mongoose';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';

export interface IAnalysis extends Document{
    plugin: string;
    key: string;
    name: string;
    description?: string;
    config: any;
    trajectory: mongoose.Types.ObjectId;
    status: 'pending' | 'running' | 'completed' | 'failed';
    outputs: {
        artifact: string;
        type?: string;
        displayName?: string;
    }[];
    exposure?: {
        canvasModifiers: boolean;
        raster?: boolean;
        analysisListing?: boolean;
    };
    totalFrames?: number;
    completedFrames?: number;
    startedAt?: Date;
    finishedAt?: Date;
    lastFrameProcessed?: number;
};

const AnalysisSchema: Schema<IAnalysis> = new Schema({
    plugin: {
        type: String,
        required: true,
        lowercase: true
    },
    key: {
        type: String,
        required: true,
        lowercase: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    config: {
        type: Schema.Types.Mixed,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    outputs: {
        type: [{
            artifact: {
                type: String,
                required: true
            },
            type: {
                type: String
            },
            displayName: {
                type: String
            }
        }],
        default: []
    },
    exposure: {
        canvasModifier: {
            type: Boolean,
            default: false
        },
        raster: {
            type: Boolean,
            default: false
        },
        analysisListing: {
            type: Boolean,
            default: false
        }
    },
    totalFrames: {
        type: Number,
        default: 0
    },
    completedFrames: {
        type: Number,
        default: 0
    },
    startedAt: Date,
    finishedAt: Date,
    lastFrameProcessed: {
        type: Number
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        cascade: 'delete',
        inverse: { path: 'analysis', behavior: 'addToSet' }
    }
}, {
    timestamps: true
});

AnalysisSchema.plugin(useInverseRelations);
AnalysisSchema.plugin(useCascadeDelete);

const Analysis: Model<IAnalysis> = mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

export default Analysis;