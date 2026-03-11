import { teamRefField, userRefField } from '@shared/infrastructure/persistence/mongo/schemaHelpers';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface TrajectoryFolderDocument extends Document {
    _id: Types.ObjectId;
    team: Types.ObjectId;
    createdBy: Types.ObjectId;
    title: string;
    parent: Types.ObjectId | null;
    createdAt: Date;
    updatedAt: Date;
}

const TrajectoryFolderSchema = new Schema<TrajectoryFolderDocument>({
    team: {
        ...teamRefField(true),
        cascade: 'delete'
    },
    createdBy: {
        ...userRefField(true)
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    parent: {
        type: Schema.Types.ObjectId,
        ref: 'TrajectoryFolder',
        default: null,
        required: false
    }
}, {
    timestamps: true
});

TrajectoryFolderSchema.index({ team: 1, parent: 1, createdAt: -1 });
TrajectoryFolderSchema.index({ team: 1, title: 1 });

const TrajectoryFolderModel: Model<TrajectoryFolderDocument> = mongoose.model<TrajectoryFolderDocument>('TrajectoryFolder', TrajectoryFolderSchema);

export default TrajectoryFolderModel;
