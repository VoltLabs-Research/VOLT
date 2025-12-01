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

import mongoose, { Schema, Model, Document } from 'mongoose';
import { encrypt, decrypt } from '@/utilities/crypto-utils';

export interface ISSHConnection extends Document {
    name: string;
    host: string;
    port: number;
    username: string;
    encryptedPassword: string;
    user: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;

    // Virtual methods
    setPassword(password: string): void;
    getPassword(): string;
}

const SSHConnectionSchema: Schema<ISSHConnection> = new Schema({
    name: {
        type: String,
        required: [true, 'SSHConnection::Name::Required'],
        minlength: [2, 'SSHConnection::Name::MinLength'],
        maxlength: [64, 'SSHConnection::Name::MaxLength'],
        trim: true
    },
    host: {
        type: String,
        required: [true, 'SSHConnection::Host::Required'],
        trim: true,
        validate: {
            validator: function (v: string) {
                // Basic validation for hostname or IP
                return /^[a-zA-Z0-9.-]+$/.test(v) || /^(\d{1,3}\.){3}\d{1,3}$/.test(v);
            },
            message: 'SSHConnection::Host::Invalid'
        }
    },
    port: {
        type: Number,
        required: [true, 'SSHConnection::Port::Required'],
        min: [1, 'SSHConnection::Port::Min'],
        max: [65535, 'SSHConnection::Port::Max'],
        default: 22
    },
    username: {
        type: String,
        required: [true, 'SSHConnection::Username::Required'],
        trim: true,
        minlength: [1, 'SSHConnection::Username::MinLength'],
        maxlength: [64, 'SSHConnection::Username::MaxLength']
    },
    encryptedPassword: {
        type: String,
        required: [true, 'SSHConnection::Password::Required'],
        select: false  // Don't include in queries by default
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'SSHConnection::User::Required'],
        index: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
SSHConnectionSchema.index({ user: 1, name: 1 });

// Method to set password (encrypts it)
SSHConnectionSchema.methods.setPassword = function (this: ISSHConnection, password: string): void {
    if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
    }
    this.encryptedPassword = encrypt(password);
};

// Method to get decrypted password
SSHConnectionSchema.methods.getPassword = function (this: ISSHConnection): string {
    if (!this.encryptedPassword) {
        throw new Error('No password stored');
    }
    return decrypt(this.encryptedPassword);
};

// Pre-save hook to ensure name uniqueness per user
SSHConnectionSchema.pre('save', async function (next) {
    if (this.isNew || this.isModified('name')) {
        const existing = await (this.constructor as Model<ISSHConnection>).findOne({
            user: this.user,
            name: this.name,
            _id: { $ne: this._id }
        });

        if (existing) {
            const error = new Error('SSHConnection::Name::Duplicate');
            return next(error);
        }
    }
    next();
});

// Transform output to hide sensitive data
SSHConnectionSchema.set('toJSON', {
    transform: function (doc, ret) {
        delete (ret as any).encryptedPassword;
        delete (ret as any).__v;
        return ret;
    }
});

const SSHConnection: Model<ISSHConnection> = mongoose.model<ISSHConnection>('SSHConnection', SSHConnectionSchema);

export default SSHConnection;
