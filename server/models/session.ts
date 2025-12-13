/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
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
import mongoose, { Schema, Model } from 'mongoose';

export interface ISession {
    _id: string;
    user: any;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: Date;
    // Login activity fields
    action: 'login' | 'logout' | 'failed_login' | 'oauth_login';
    success: boolean;
    failureReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

const SessionSchema: Schema<ISession> = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [
            function (this: any){
                return this.action !== 'failed_login'; 
            }, 
            ValidationCodes.SESSION_SUCCESS_REQUIRED
        ]
    },
    token: {
        type: String,
        // Allow missing token on failed logins
        required: [
            function (this: any){
                return this.action !== 'failed_login'; 
            }, 
            ValidationCodes.SESSION_TOKEN_REQUIRED
        ]
    },
    userAgent: {
        type: String,
        required: [true, ValidationCodes.SESSION_USER_AGENT_REQUIRED],
        trim: true
    },
    ip: {
        type: String,
        required: [true, ValidationCodes.SESSION_IP_REQUIRED],
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    // Login activity fields
    action: {
        type: String,
        required: [true, ValidationCodes.SESSION_ACTION_REQUIRED],
        enum: ['login', 'logout', 'failed_login', 'oauth_login'],
        default: 'login'
    },
    success: {
        type: Boolean,
        required: [true, ValidationCodes.SESSION_SUCCESS_REQUIRED],
        default: true
    },
    failureReason: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

SessionSchema.index({ user: 1, isActive: 1 });
// Unique token only when token is a string (skip null/undefined for failed logins)
SessionSchema.index({ token: 1 }, { unique: true, partialFilterExpression: { token: { $type: 'string' } } });
SessionSchema.index({ lastActivity: -1 });
SessionSchema.index({ action: 1, createdAt: -1 });
SessionSchema.index({ success: 1, createdAt: -1 });

const Session: Model<ISession> = mongoose.model<ISession>('Session', SessionSchema);

export default Session;
