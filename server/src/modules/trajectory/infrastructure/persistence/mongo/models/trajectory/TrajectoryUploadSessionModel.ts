import mongoose, { Schema, Model, Document } from 'mongoose';

export type TrajectoryUploadSessionStatus = 'pending' | 'committed' | 'cancelled' | 'failed';

export interface TrajectoryUploadSessionPartProps {
    partNumber: number;
    objectKey: string;
    offset: number;
    size: number;
}

export interface TrajectoryUploadSessionFileProps {
    index: number;
    originalName: string;
    contentType?: string;
    size: number;
    finalObjectKey: string;
    parts: TrajectoryUploadSessionPartProps[];
}

export interface TrajectoryUploadSessionDocument extends Document {
    team: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    ownerClusterId: mongoose.Types.ObjectId;
    bucket: string;
    resourceKind: string;
    resourceId: mongoose.Types.ObjectId;
    status: TrajectoryUploadSessionStatus;
    files: TrajectoryUploadSessionFileProps[];
    expiresAt: Date;
    committedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PartSchema = new Schema<TrajectoryUploadSessionPartProps>({
    partNumber: { type: Number, required: true },
    objectKey: { type: String, required: true },
    offset: { type: Number, required: true },
    size: { type: Number, required: true }
}, { _id: false });

const FileSchema = new Schema<TrajectoryUploadSessionFileProps>({
    index: { type: Number, required: true },
    originalName: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number, required: true },
    finalObjectKey: { type: String, required: true },
    parts: { type: [PartSchema], required: true }
}, { _id: false });

const TrajectoryUploadSessionSchema = new Schema<TrajectoryUploadSessionDocument>({
    team: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    ownerClusterId: { type: Schema.Types.ObjectId, ref: 'TeamCluster', required: true, index: true },
    bucket: { type: String, required: true },
    resourceKind: { type: String, required: true, index: true },
    resourceId: { type: Schema.Types.ObjectId, required: true, index: true },
    status: {
        type: String,
        enum: ['pending', 'committed', 'cancelled', 'failed'],
        default: 'pending',
        index: true
    },
    files: { type: [FileSchema], required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    committedAt: { type: Date }
}, {
    timestamps: true
});

TrajectoryUploadSessionSchema.index({ team: 1, resourceKind: 1, resourceId: 1, status: 1 });

const TrajectoryUploadSessionModel: Model<TrajectoryUploadSessionDocument> = mongoose.model(
    'TrajectoryUploadSession',
    TrajectoryUploadSessionSchema
);

export default TrajectoryUploadSessionModel;
