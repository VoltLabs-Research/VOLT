import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import { Document, Model, Schema } from 'mongoose';
import mongoose from 'mongoose';
import type { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

export enum ScriptingNotebookRelation {
    Team = 'team',
    TeamCluster = 'teamCluster',
    ContainerResources = 'containerResources',
    RuntimeNotebookId = 'runtimeNotebookId',
    Trajectory = 'trajectory',
    CreatedBy = 'createdBy'
};

export interface ScriptingNotebookDocument extends Persistable<ScriptingNotebookProps, `${ScriptingNotebookRelation}`>, Document {};

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
        ...teamRefField(true),
        cascade: 'delete'
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
