import mongoose, { Schema, Model, Document } from 'mongoose';
import { SimulationCellProps, SimulationCellDims, SimulationCellGeometry } from '@/src/modules/simulation-cell/domain/entities/SimulationCell';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type SimulationCellRelations = 'team' | 'trajectory';

export interface SimulationCellDocument extends Persistable<SimulationCellProps, SimulationCellRelations>, Document { }

const SimulationCellDimsSchema: Schema<SimulationCellDims> = new Schema({
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    length: { type: Number, required: true }
}, { _id: false });

const SimulationCellGeometrySchema: Schema<SimulationCellGeometry> = new Schema({
    cell_vectors: [[Number]],
    cell_origin: [Number],
    periodic_boundary_conditions: {
        x: { type: Boolean, required: true },
        y: { type: Boolean, required: true },
        z: { type: Boolean, required: true }
    }
}, { _id: false });

const SimulationCellSchema: Schema<SimulationCellDocument> = new Schema({
    boundingBox: {
        type: SimulationCellDimsSchema,
        required: true
    },
    geometry: {
        type: SimulationCellGeometrySchema,
        required: true
    },
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    trajectory: {
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        required: true
    },
    timestep: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const SimulationCellModel: Model<SimulationCellDocument> = mongoose.model<SimulationCellDocument>('SimulationCell', SimulationCellSchema);

export default SimulationCellModel;
