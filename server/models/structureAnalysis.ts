import mongoose, { Schema, Model } from 'mongoose';
import { IStructureAnalysis, IStructureTypeStat } from '@types/models/structureAnalysis';
import Trajectory from '@models/trajectory';

const StructureTypeStatSchema = new Schema<IStructureTypeStat>({
    name: {
        type: String,
        required: true,
        trim: true
    },
    count: {
        type: Number,
        required: true
    },
    percentage: {
        type: Number,
        required: true
    },
    typeId: {
        type: Number,
        required: true
    }
}, { _id: false });

const StructureAnalysisSchema: Schema<IStructureAnalysis> = new Schema({
    totalAtoms: {
        type: Number,
        required: true
    },
    timestep: {
        type: Number,
        required: true,
    },
    analysisMethod: {
        type: String,
        required: true,
        enum: ['PTM', 'CNA']
    },
    types: {
        type: [StructureTypeStatSchema],
        required: true
    },
    identifiedStructures: {
        type: Number,
        required: true
    },
    unidentifiedStructures: {
        type: Number,
        required: true
    },
    identificationRate: {
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

StructureAnalysisSchema.index({ trajectory: 1, timestep: 1, analysisMethod: 1 }, { unique: true });

StructureAnalysisSchema.post('save', async function(doc, next){
    await Trajectory.findByIdAndUpdate(doc.trajectory, {
        $addToSet: { structureAnalysis: doc._id }
    });
    next();
});

const StructureAnalysis: Model<IStructureAnalysis> = mongoose.model<IStructureAnalysis>('StructureAnalysis', StructureAnalysisSchema);

export default StructureAnalysis;