import mongoose, { Schema } from 'mongoose';

export interface ScriptingNotebookDocument {
    _id: string;
    team: string;
    title: string;
    notebookPath: string;
    trajectories: string[];
    createdBy: string;
    content: Record<string, unknown>;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

const scriptingNotebookSchema = new Schema<ScriptingNotebookDocument>({
    team: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    notebookPath: {
        type: String,
        required: true,
        trim: true
    },
    trajectories: [{
        type: String,
        required: true
    }],
    createdBy: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: Schema.Types.Mixed,
        required: true
    },
    lastOpenedAt: {
        type: Date
    }
}, {
    collection: 'scriptingnotebooks',
    timestamps: true,
    minimize: false
});

export const ScriptingNotebookModel = mongoose.models.DaemonScriptingNotebook
    || mongoose.model<ScriptingNotebookDocument>('DaemonScriptingNotebook', scriptingNotebookSchema);
