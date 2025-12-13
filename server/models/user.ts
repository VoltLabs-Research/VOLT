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

import mongoose, { Schema, Model } from 'mongoose';
import validator from 'validator';
import { Notification, Team } from '@/models/index';
import bcrypt from 'bcryptjs';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
// @ts-ignore
import { IUser } from '@types/models/user';
import { ValidationCodes } from '@/constants/validation-codes';

const UserSchema: Schema<IUser> = new Schema({
    email: {
        type: String,
        required: [true, ValidationCodes.USER_EMAIL_REQUIRED],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, ValidationCodes.USER_EMAIL_INVALID]
    },
    password: {
        type: String,
        required: function (this: IUser) {
            // Password only required for non-OAuth users
            return !this.oauthProvider;
        },
        minlength: [8, ValidationCodes.USER_PASSWORD_MINLEN],
        maxlength: [16, ValidationCodes.USER_PASSWORD_MAXLEN],
        select: false
    },
    role: {
        type: String,
        lowercase: true,
        enum: ['user', 'admin'],
        default: 'user'
    },
    passwordChangedAt: Date,
    firstName: {
        type: String,
        minlength: [4, ValidationCodes.USER_FIRST_NAME_MINLEN],
        maxlength: [64, ValidationCodes.USER_FIRST_NAME_MAXLEN],
        required: [true, ValidationCodes.USER_FIRST_NAME_REQUIRED],
        lowercase: true,
        trim: true
    },
    lastName: {
        type: String,
        minlength: [4, ValidationCodes.USER_LAST_NAME_MINLEN],
        maxlength: [64, ValidationCodes.USER_LAST_NAME_MAXLEN],
        required: [true, ValidationCodes.USER_LAST_NAME_REQUIRED],
        lowercase: true,
        trim: true
    },
    teams: [{
        type: Schema.Types.ObjectId,
        ref: 'Team',
        cascade: 'pull'
    }],
    // OAuth fields
    oauthProvider: {
        type: String,
        enum: ['github', 'google', 'microsoft', null],
        default: null
    },
    oauthId: {
        type: String,
        sparse: true
    },
    avatar: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

UserSchema.plugin(useCascadeDelete);
UserSchema.index({ email: 'text' });
UserSchema.index({ oauthProvider: 1, oauthId: 1 }, { unique: true, sparse: true });

UserSchema.pre('save', async function (this: IUser & { isNew: boolean }, next) {
    if (!this.isModified('password')) return next();

    // Skip password hashing for OAuth users without password
    if (!this.password) return next();

    this.password = await bcrypt.hash(this.password, 12);

    if (!this.isNew) {
        this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
});

UserSchema.pre('save', async function (this: IUser & { isNew: boolean }, next) {
    if (this.isNew && !this.avatar) {
        try {
            // Generate default avatar using email as seed
            const { AvatarService } = await import('@services/avatar');
            this.avatar = await AvatarService.generateAndUploadDefaultAvatar(
                this._id.toString(),
                this.email
            );
        } catch (error) {
            console.error('Failed to generate default avatar:', error);
            // Don't block user creation if avatar generation fails
        }
    }
    next();
});

UserSchema.post('save', async function (doc, next) {
    // Can we use this.isNew?
    const isNewUser = this.createdAt.getTime() === this.updatedAt.getTime();
    if (isNewUser) {
        const capitalizedFirstName = this.firstName.charAt(0).toUpperCase() + this.firstName.slice(1);
        const newTeam = await Team.create({
            name: `${capitalizedFirstName}'s Team`,
            owner: this._id,
            members: [this._id]
        });

        await mongoose.model('User').findByIdAndUpdate(this._id, {
            $push: { teams: newTeam._id }
        });

        await Notification.create([
            {
                recipient: doc._id,
                title: 'Welcome to the platform!',
                content: `We're excited to have you, ${capitalizedFirstName}. You can start by exploring your dashboard and uploading your first trajectory.`,
                link: '/dashboard'
            },
            {
                recipient: doc._id,
                title: 'Your personal team is ready',
                content: `We've automatically created a team for you called "${newTeam.name}". All your new trajectories can be added here.`,
                link: `/teams/${newTeam._id}`
            }
        ]);
    }
    next();
});

UserSchema.methods.isCorrectPassword = function (candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.isPasswordChangedAfterJWFWasIssued = function (jwtTimestamp: number): boolean {
    if (this.passwordChangedAt) {
        const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return jwtTimestamp < changedTimestamp;
    }
    return false;
};

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;