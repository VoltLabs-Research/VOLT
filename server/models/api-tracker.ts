/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
