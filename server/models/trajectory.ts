/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import mongoose, { Schema, Model } from 'mongoose';
import * as fs from 'fs';
import * as os from 'node:os';
import { rm } from 'fs/promises';
import path from 'path';
// @ts-ignore
import type { ITrajectory, ITimestepInfo } from '@types/models/trajectory';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import DumpStorage from '@/services/dump-storage';
import logger from '@/logger';

const TimestepInfoSchema: Schema<ITimestepInfo> = new Schema({
    timestep: { type: Number, required: true },
    natoms: { type: Number, required: true },
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
    status: {
        type: String,
        lowercase: true,
        enum: ['queued', 'processing', 'rendering', 'completed', 'analyzing', 'failed'],
        default: 'queued'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    analysis: [{
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
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
    }
}, {
    timestamps: true,
});

TrajectorySchema.plugin(useInverseRelations);
TrajectorySchema.plugin(useCascadeDelete);

TrajectorySchema.index({ name: 'text', status: 'text' });

TrajectorySchema.pre('findOneAndDelete', async function (next) {
    const trajectoryToDelete = await this.model.findOne(this.getFilter());
    if (!trajectoryToDelete) {
        return next();
    }

    const trajectoryId = trajectoryToDelete._id.toString();
    const { existsSync } = fs;
    const trajectoryDir = process.env.TRAJECTORY_DIR || path.join(os.tmpdir(), 'opendxa-trajectories');
    const trajectoryPath = path.join(trajectoryDir, trajectoryId);

    try {
        if (existsSync(trajectoryPath)) {
            logger.info(`Removing temp trajectory directory: ${trajectoryPath}`);
            await rm(trajectoryPath, { recursive: true });
        }

        // Clean up MinIO dumps
        try {
            await DumpStorage.deleteDumps(trajectoryId);
            logger.info(`Cleaned up MinIO dumps for trajectory: ${trajectoryId}`);
        } catch (err) {
            logger.error(`Failed to clean up dumps: ${err}`);
        }

        // Clean up other MinIO buckets
        const objectName = `trajectory-${trajectoryId}`;
        const buckets = Object.values(SYS_BUCKETS).filter(b => b !== SYS_BUCKETS.DUMPS);
        for (const bucket of buckets) {
            try {
                await storage.deleteByPrefix(bucket, objectName);
            } catch (err) {
                logger.error(err)
            }
        }

        next();
    } catch (error) {
        next(error as Error);
    }
});

const Trajectory: Model<ITrajectory> = mongoose.model('Trajectory', TrajectorySchema);

export default Trajectory;