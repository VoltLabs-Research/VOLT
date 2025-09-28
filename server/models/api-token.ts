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

import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IApiToken extends Document {
    name: string;
    description?: string;
    token: string;
    tokenHash: string;
    permissions: string[];
    expiresAt?: Date;
    lastUsedAt?: Date;
    isActive: boolean;
    createdBy: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
    
    generateToken(): string;
    isExpired(): boolean;
    hasPermission(permission: string): boolean;
    updateLastUsed(): Promise<void>;
}

export interface IApiTokenModel extends Model<IApiToken> {
    findByToken(token: string): Promise<IApiToken | null>;
    findByUser(userId: string): Promise<IApiToken[]>;
}

const apiTokenSchema = new Schema<IApiToken>({
    name: {
        type: String,
        required: [true, 'Token name is required'],
        trim: true,
        maxlength: [100, 'Token name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    token: {
        type: String,
        required: true,
        unique: true,
        select: false 
    },
    tokenHash: {
        type: String,
        required: true,
        select: false
    },
    permissions: [{
        type: String,
        enum: [
            'read:trajectories',
            'write:trajectories',
            'delete:trajectories',
            'read:analysis',
            'write:analysis',
            'delete:analysis',
            'read:teams',
            'write:teams',
            'admin:all'
        ],
        default: ['read:trajectories']
    }],
    expiresAt: {
        type: Date,
        // TTL index
        index: { expireAfterSeconds: 0 }
    },
    lastUsedAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

apiTokenSchema.index({ createdBy: 1, isActive: 1 });
apiTokenSchema.index({ tokenHash: 1 });
apiTokenSchema.index({ expiresAt: 1 });

apiTokenSchema.virtual('maskedToken').get(function() {
    if (!this.token) return '';
    return `${this.token.substring(0, 8)}...${this.token.substring(this.token.length - 4)}`;
});

apiTokenSchema.virtual('status').get(function() {
    if (!this.isActive) return 'inactive';
    if (this.isExpired()) return 'expired';
    return 'active';
});


apiTokenSchema.methods.generateToken = function(): string {
    return `opendxa_${crypto.randomBytes(32).toString('hex')}`;
};

apiTokenSchema.methods.isExpired = function(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

apiTokenSchema.methods.hasPermission = function(permission: string): boolean {
    return this.permissions.includes(permission) || this.permissions.includes('admin:all');
};

apiTokenSchema.methods.updateLastUsed = async function(): Promise<void> {
    this.lastUsedAt = new Date();
    await this.save();
};

apiTokenSchema.statics.findByToken = function(this: mongoose.Model<IApiToken>, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    return this.findOne({ tokenHash, isActive: true }).select('+token');
};

apiTokenSchema.statics.findByUser = function(this: mongoose.Model<IApiToken>, userId: string) {
    return this.find({ createdBy: userId, isActive: true }).select('+token').sort({ createdAt: -1 });
};

apiTokenSchema.post('save', function() {
    // Clean up expired tokens in background
    mongoose.model('ApiToken').deleteMany({ 
        expiresAt: { $lt: new Date() },
        isActive: true 
    }).exec();
});

const ApiToken = mongoose.model<IApiToken, IApiTokenModel>('ApiToken', apiTokenSchema);

export default ApiToken;