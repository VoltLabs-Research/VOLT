import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema } from 'mongoose';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

/**
 * LatexFile persisted shape. Formerly lived in `entities/LatexFile` — inlined
 * here (pollium style) so the model is self-contained after the domain-entity
 * layer was removed. `fullPath` (the former entity getter) is now computed by
 * callers as `path ? path + name : name`.
 */
export interface LatexFileProps {
    document: string;
    team: string;
    /** Filename, e.g. `main.tex` or `introduction.tex`. */
    name: string;
    /**
     * Directory prefix within the project tree (e.g. `""` for root,
     * `"chapters/"` for a subdirectory). Must end with `/` when non-empty.
     */
    path: string;
    content: string;
    /**
     * Exactly one file per document must have this flag set to `true`.
     * The entrypoint is the file passed to the LaTeX compiler.
     */
    isEntrypoint: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

type LatexFileRelations = 'document' | 'team' | 'createdBy';

export interface LatexFileDocument extends Persistable<LatexFileProps, LatexFileRelations>, Document {}

const LatexFileSchema: Schema<LatexFileDocument> = new Schema({
    document: {
        type: Schema.Types.ObjectId,
        ref: 'LatexDocument',
        required: true
    },
    team: {
        ...teamRefField(true)
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    path: {
        type: String,
        default: '',
        trim: true
    },
    content: {
        type: String,
        default: ''
    },
    isEntrypoint: {
        type: Boolean,
        default: false
    },
    createdBy: {
        ...userRefField(true)
    }
}, {
    timestamps: true
});

/** Prevents duplicate filenames at the same path within a document. */
LatexFileSchema.index({ document: 1, name: 1, path: 1 }, { unique: true });
LatexFileSchema.index({ document: 1, isEntrypoint: 1 });
LatexFileSchema.index({ document: 1, createdAt: 1 });
LatexFileSchema.index({ team: 1 });

const LatexFileModel: Model<LatexFileDocument> = mongoose.model<LatexFileDocument>(
    'LatexFile',
    LatexFileSchema
);

export default LatexFileModel;
