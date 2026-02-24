import mongoose, { Schema, Document, Model } from 'mongoose';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import { ScriptingNotebookProps } from '@modules/scripting/domain/entities/ScriptingNotebook';
import { teamRefField, trajectoryRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';

type ScriptingNotebookRelations = 'team' | 'trajectories' | 'createdBy';

export interface ScriptingNotebookDocument extends Persistable<ScriptingNotebookProps, ScriptingNotebookRelations>, Document {}

const ScriptingNotebookSchema: Schema<ScriptingNotebookDocument> = new Schema({
    team: {
        ...teamRefField(true),
        cascade: 'delete'
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
        ...trajectoryRefField(true)
    }],
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

ScriptingNotebookSchema.index({ team: 1, trajectories: 1, createdAt: -1 });
ScriptingNotebookSchema.index({ team: 1, notebookPath: 1 }, { unique: true });

const ScriptingNotebookModel: Model<ScriptingNotebookDocument> = mongoose.model<ScriptingNotebookDocument>(
    'ScriptingNotebook',
    ScriptingNotebookSchema
);

export default ScriptingNotebookModel;
