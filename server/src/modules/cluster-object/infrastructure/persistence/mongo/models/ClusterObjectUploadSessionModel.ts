import mongoose, { Schema, Model, Document } from 'mongoose';

export type ClusterObjectUploadSessionStatus = 'pending' | 'committed' | 'cancelled' | 'failed';

export interface ClusterObjectUploadSessionPartProps {
    partNumber: number;
    objectKey: string;
    offset: number;
    size: number;
}

export interface ClusterObjectUploadSessionFileProps {
    index: number;
    originalName: string;
    contentType?: string;
    size: number;
    finalObjectKey: string;
    parts: ClusterObjectUploadSessionPartProps[];
}

export interface ClusterObjectUploadSessionDocument extends Document {
    team: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    ownerClusterId: mongoose.Types.ObjectId;
    bucket: string;
    resourceKind: string;
    resourceId: mongoose.Types.ObjectId;
    status: ClusterObjectUploadSessionStatus;
    files: ClusterObjectUploadSessionFileProps[];
    expiresAt: Date;
    committedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const PartSchema = new Schema<ClusterObjectUploadSessionPartProps>({
    partNumber: { type: Number, required: true },
    objectKey: { type: String, required: true },
    offset: { type: Number, required: true },
    size: { type: Number, required: true }
}, { _id: false });

const FileSchema = new Schema<ClusterObjectUploadSessionFileProps>({
    index: { type: Number, required: true },
    originalName: { type: String, required: true },
    contentType: { type: String },
    size: { type: Number, required: true },
    finalObjectKey: { type: String, required: true },
    parts: { type: [PartSchema], required: true }
}, { _id: false });

const ClusterObjectUploadSessionSchema = new Schema<ClusterObjectUploadSessionDocument>({
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

ClusterObjectUploadSessionSchema.index({ team: 1, resourceKind: 1, resourceId: 1, status: 1 });

const ClusterObjectUploadSessionModel: Model<ClusterObjectUploadSessionDocument> = mongoose.model(
    'ClusterObjectUploadSession',
    ClusterObjectUploadSessionSchema
);

export default ClusterObjectUploadSessionModel;
