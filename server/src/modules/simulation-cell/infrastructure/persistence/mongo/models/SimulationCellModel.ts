import { teamRefField, trajectoryRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Schema, Model, Document } from 'mongoose';
import type { SimulationCellDims, SimulationCellGeometry, SimulationCellProps } from '@modules/simulation-cell/domain/entities/SimulationCell';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum SimulationCellRelation {
    Team = 'team',
    Trajectory = 'trajectory'
}

type SimulationCellRelations = SimulationCellRelation.Team | SimulationCellRelation.Trajectory;

export interface SimulationCellDocument extends Persistable<
    SimulationCellProps,
    SimulationCellRelations
>, Document {
}

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
    boundingBox: SimulationCellDimsSchema,
    geometry: SimulationCellGeometrySchema,
    team: teamRefField(),
    trajectory: trajectoryRefField(),
    timestep: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

const SimulationCellModel: Model<SimulationCellDocument> = mongoose.model<SimulationCellDocument>('SimulationCell', SimulationCellSchema);

export default SimulationCellModel;
