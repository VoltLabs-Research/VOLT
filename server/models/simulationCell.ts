import mongoose, { Schema, Model } from 'mongoose';
import { ICellAnalysis } from '@types/models/simulationCell';

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
    inverseMatrix: {
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
        required: true
    }
}, {
    timestamps: true
});

SimulationCellSchema.index({ trajectory: 1, timestep: 1 }, { unique: true });

const SimulationCell: Model<ICellAnalysis> = mongoose.model<ICellAnalysis>('SimulationCell', SimulationCellSchema);

export default SimulationCell;