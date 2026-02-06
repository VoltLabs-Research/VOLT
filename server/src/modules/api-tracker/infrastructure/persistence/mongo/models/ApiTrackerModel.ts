import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IApiTrackerDocument extends Document {
    method: string;
    url: string;
    userAgent?: string;
    ip: string;
    user?: mongoose.Types.ObjectId;
    statusCode: number;
    responseTime: number;
    requestBody?: any;
    queryParams?: any;
    headers?: any;
    createdAt: Date;
    updatedAt: Date;
}

const ApiTrackerSchema: Schema<IApiTrackerDocument> = new Schema({
    method: {
        type: String,
        required: true,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
        uppercase: true
    },
    url: {
        type: String,
        required: true,
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    ip: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    statusCode: {
        type: Number,
        required: true,
        min: 100,
        max: 599
    },
    responseTime: {
        type: Number,
        required: true,
        min: 0
    },
    requestBody: {
        type: Schema.Types.Mixed,
        required: false
    },
    queryParams: {
        type: Schema.Types.Mixed,
        required: false
    },
    headers: {
        type: Schema.Types.Mixed,
        required: false
    }
}, {
    timestamps: true
});

ApiTrackerSchema.index({ user: 1, createdAt: -1 });
ApiTrackerSchema.index({ ip: 1, createdAt: -1 });
ApiTrackerSchema.index({ method: 1, url: 1 });
ApiTrackerSchema.index({ statusCode: 1, createdAt: -1 });
ApiTrackerSchema.index({ createdAt: -1 });

export const ApiTrackerModel: Model<IApiTrackerDocument> = mongoose.model<IApiTrackerDocument>('ApiTracker', ApiTrackerSchema);
