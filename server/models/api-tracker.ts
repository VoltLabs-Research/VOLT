import { ValidationCodes } from '@/constants/validation-codes';
import mongoose, { Schema, Model, Document } from 'mongoose';

export interface IApiTracker extends Document {
    // TODO: fix any type for _id
    _id: any;
    method: string;
    url: string;
    userAgent?: string;
    ip: string;
    user?: string;
    statusCode: number;
    responseTime: number;
    requestBody?: any;
    queryParams?: any;
    headers?: any;
    createdAt: Date;
    updatedAt: Date;
}

const ApiTrackerSchema: Schema<IApiTracker> = new Schema({
    method: {
        type: String,
        required: [true, ValidationCodes.API_TRACKER_METHOD_REQUIRED],
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
        uppercase: true
    },
    url: {
        type: String,
        required: [true, ValidationCodes.API_TRACKER_URL_REQUIRED],
        trim: true
    },
    userAgent: {
        type: String,
        trim: true
    },
    ip: {
        type: String,
        required: [true, ValidationCodes.API_TRACKER_IP_REQUIRED],
        trim: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    statusCode: {
        type: Number,
        required: [true, ValidationCodes.API_TRACKER_STATUS_CODE_REQUIRED],
        min: [100, ValidationCodes.API_TRACKER_STATUS_CODE_MIN],
        max: [599, ValidationCodes.API_TRACKER_STATUS_CODE_MAX]
    },
    responseTime: {
        type: Number,
        required: [true, ValidationCodes.API_TRACKER_RESPONSE_TIME_REQUIRED],
        min: [0, ValidationCodes.API_TRACKER_RESPONSE_TIME_MIN]
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

const ApiTracker: Model<IApiTracker> = mongoose.model<IApiTracker>('ApiTracker', ApiTrackerSchema);

export default ApiTracker;
