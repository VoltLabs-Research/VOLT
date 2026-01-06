
import mongoose, { Schema, Model } from 'mongoose';
import { ISimulationCell } from '@/types/models/simulation-cell';

const SimulationCellSchema: Schema<ISimulationCell> = new Schema({
    boundingBox: {
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        length: { type: Number, required: true }
    },
    geometry: {
        cell_vectors: [[Number]],
        cell_origin: [Number],
        periodic_boundary_conditions: {
            x: { type: Boolean, required: true },
            y: { type: Boolean, required: true },
            z: { type: Boolean, required: true }
        }
    }
}, {
    timestamps: true
});

const SimulationCell: Model<ISimulationCell> = mongoose.model('SimulationCell', SimulationCellSchema);

export default SimulationCell;
