import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export interface ScriptingNotebookContainerResources {
    cpus: number;
    memoryMB: number;
}

/**
 * The scripting notebook's persisted property shape. Previously lived in the
 * (now-deleted) `entities/ScriptingNotebook` file; inlined here since the model
 * is the only remaining consumer (the service talks to the model directly).
 */
export interface ScriptingNotebookProps {
    team: string;
    teamCluster?: string;
    containerResources?: ScriptingNotebookContainerResources;
    runtimeNotebookId?: string;
    title: string;
    notebookPath: string;
    trajectory?: string | null;
    createdBy: string;
    content: Record<string, unknown>;
    secretKeyId?: string;
    secretKeyEncrypted?: string;
    lastOpenedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

type ScriptingNotebookRelations = 'team' | 'teamCluster' | 'trajectory' | 'createdBy';

export interface ScriptingNotebookDocument extends Persistable<ScriptingNotebookProps, ScriptingNotebookRelations>, Document {};

const ScriptingNotebookContainerResourcesSchema = new Schema({
    cpus: {
        type: Number,
        required: true,
        min: 0.5
    },
    memoryMB: {
        type: Number,
        required: true,
        min: 128
    }
}, {
    _id: false,
    id: false
});

const ScriptingNotebookSchema: Schema<ScriptingNotebookDocument> = new Schema({
    team: {
        ...teamRefField(true)
    },
    teamCluster: {
        type: Schema.Types.ObjectId,
        ref: 'TeamCluster',
        required: true
    },
    containerResources: {
        type: ScriptingNotebookContainerResourcesSchema,
        required: false,
        default: undefined
    },
    runtimeNotebookId: {
        type: String,
        required: false,
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
    trajectory: {
        ...trajectoryRefField(false),
        required: false,
        default: null
    },
    createdBy: {
        ...userRefField(true)
    },
    content: {
        type: Schema.Types.Mixed,
        required: true
    },
    secretKeyId: {
        type: String,
        required: false,
        trim: true
    },
    secretKeyEncrypted: {
        type: String,
        required: false
    },
    lastOpenedAt: {
        type: Date
    }
}, {
    timestamps: true,
    minimize: false
});

ScriptingNotebookSchema.index({
    team: 1,
    trajectory: 1,
    createdAt: -1
});
ScriptingNotebookSchema.index({ team: 1, notebookPath: 1 }, { unique: true });

const ScriptingNotebookModel: Model<ScriptingNotebookDocument> = mongoose.model<ScriptingNotebookDocument>(
    'ScriptingNotebook',
    ScriptingNotebookSchema
);

export default ScriptingNotebookModel;
