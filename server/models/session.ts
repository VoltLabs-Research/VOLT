/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import mongoose, { Schema, Model } from 'mongoose';

export interface ISession {
    _id: string;
    user: any;
    token: string;
    userAgent: string;
    ip: string;
    isActive: boolean;
    lastActivity: Date;
    createdAt: Date;
    updatedAt: Date;
}

const SessionSchema: Schema<ISession> = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Session::User::Required']
    },
    token: {
        type: String,
        required: [true, 'Session::Token::Required'],
        unique: true
    },
    userAgent: {
        type: String,
        required: [true, 'Session::UserAgent::Required'],
        trim: true
    },
    ip: {
        type: String,
        required: [true, 'Session::Ip::Required'],
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

SessionSchema.index({ user: 1, isActive: 1 });
SessionSchema.index({ token: 1 });
SessionSchema.index({ lastActivity: -1 });

const Session: Model<ISession> = mongoose.model<ISession>('Session', SessionSchema);

export default Session;
