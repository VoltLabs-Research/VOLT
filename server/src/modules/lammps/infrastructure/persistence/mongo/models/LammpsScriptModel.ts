import mongoose, { Document, Model, Schema } from 'mongoose';

export interface LammpsScriptDocument extends Document {
    team: mongoose.Types.ObjectId;
    title: string;
    mpiRanks: number;
    openmpThreads: number;
    folder: mongoose.Types.ObjectId | null;
    container: mongoose.Types.ObjectId;
    rootPath: string;
    entryFilePath: string;
    createdBy: mongoose.Types.ObjectId;
    lastEditedBy?: mongoose.Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const LammpsScriptSchema = new Schema<LammpsScriptDocument>({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    mpiRanks: {
        type: Number,
        default: 1,
        min: 1
    },
    openmpThreads: {
        type: Number,
        default: 1,
        min: 1
    },
    folder: {
        type: Schema.Types.ObjectId,
        ref: 'CatalogFolder',
        default: null,
        index: true
    },
    container: {
        type: Schema.Types.ObjectId,
        ref: 'LammpsContainer',
        required: true,
        index: true
    },
    rootPath: {
        type: String,
        required: true,
        trim: true
    },
    entryFilePath: {
        type: String,
        required: true,
        trim: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastEditedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true,
    minimize: false
});

LammpsScriptSchema.index({ team: 1, updatedAt: -1 }, { name: 'lammps_script_team_updated_idx' });
LammpsScriptSchema.index({ team: 1, folder: 1, updatedAt: -1 }, { name: 'lammps_script_team_folder_updated_idx' });

const LammpsScriptModel: Model<LammpsScriptDocument> = mongoose.models.LammpsScript
    || mongoose.model<LammpsScriptDocument>('LammpsScript', LammpsScriptSchema);

export default LammpsScriptModel;
