import { TrajectoryFrame } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

import mongoose, { Schema, Model, Document, Types } from 'mongoose';

type TrajectoryFramePersistedRelations = 'trajectoryId' | 'simulationCell';

export interface TrajectoryFramePersisted extends TrajectoryFrame {
    trajectoryId: string;
}

export interface TrajectoryFrameDocument
    extends Persistable<TrajectoryFramePersisted, TrajectoryFramePersistedRelations>, Document { };

const TrajectoryFrameSchema: Schema<TrajectoryFrameDocument> = new Schema({
    trajectoryId: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true,
        index: true
    },
    timestep: {
        type: Number,
        required: true
    },
    natoms: {
        type: Number,
        required: true
    },
    simulationCell: {
        type: Schema.Types.ObjectId,
        ref: 'SimulationCell',
        required: false,
        default: undefined
    }
}, {
    timestamps: false,
    // Why: each trajectory can emit dozens of thousands of frames. Keeping the
    // collection lean means dropping per-doc audit fields that already exist on
    // the parent Trajectory document. The compound (trajectoryId, timestep)
    // unique index is the only access pattern for this collection.
    minimize: true
});

// Why: compound unique index gives us `insertOne` contention-free frame
// appends (vs the old `$push`) and O(log n) `getFrames(trajectoryId)` queries
// with pagination by timestep.
TrajectoryFrameSchema.index(
    { trajectoryId: 1, timestep: 1 },
    { unique: true }
);

export interface TrajectoryFrameLean {
    _id: Types.ObjectId;
    trajectoryId: Types.ObjectId;
    timestep: number;
    natoms: number;
    simulationCell: Types.ObjectId;
}

const TrajectoryFrameModel: Model<TrajectoryFrameDocument> = mongoose.model(
    'TrajectoryFrame',
    TrajectoryFrameSchema
);

export default TrajectoryFrameModel;
