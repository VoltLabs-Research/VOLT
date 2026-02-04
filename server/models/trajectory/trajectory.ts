import mongoose, { Schema, Model } from 'mongoose';
import * as fs from 'fs';
import { rm } from 'fs/promises';
import path from 'path';
// @ts-ignore
import type { ITrajectory, ITimestepInfo } from '@types/models/trajectory';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import DumpStorage from '@/services/trajectory/dump-storage';
import logger from '@/logger';
import { ValidationCodes } from '@/constants/validation-codes';
import TempFileManager from '@/services/temp-file-manager';

const TimestepInfoSchema: Schema<ITimestepInfo> = new Schema({
    timestep: { type: Number, required: true },
    natoms: { type: Number, required: true },
    simulationCell: {
        type: Schema.Types.ObjectId,
        ref: 'SimulationCell',
        required: true
    }
}, { _id: false });

const TrajectorySchema: Schema<ITrajectory> = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.TRAJECTORY_NAME_REQUIRED],
        minlength: [4, ValidationCodes.TRAJECTORY_NAME_MINLEN],
        maxlength: [64, ValidationCodes.TRAJECTORY_NAME_MAXLEN],
        trim: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
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
        enum: ['queued', 'waiting_for_proccess', 'processing', 'rendering', 'completed', 'analyzing', 'failed'],
        default: 'queued'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    analysis: [{
        type: Schema.Types.ObjectId,
        ref: 'Analysis',
        cascade: 'delete',
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
    uploadId: {
        type: String,
        select: true // We need this on client to deduplicate
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
    const trajectoryDir = process.env.TRAJECTORY_DIR || path.join(TempFileManager.rootPath, 'trajectories');
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

        // TODO:
        await Promise.all([
            mongoose.model('PluginExposureMeta').deleteMany({ trajectory: trajectoryId }),
            mongoose.model('PluginListingRow').deleteMany({ trajectory: trajectoryId })
        ]);
        next();
    } catch (error) {
        next(error as Error);
    }
});

const Trajectory: Model<ITrajectory> = mongoose.model('Trajectory', TrajectorySchema);

export default Trajectory;
