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

import mongoose, { Schema, Model, HookNextFunction } from 'mongoose';
import validator from 'validator';
import Notification from '@models/notification';
import bcrypt from 'bcryptjs';
import Trajectory from '@models/trajectory';
import { IUser } from '@types/models/user';

const UserSchema: Schema<IUser> = new Schema({
    email: {
        type: String,
        required: [true, 'User::Email::Required'],
        unique: true,
        lowercase: true,
        trim: true,
        validate: [validator.isEmail, 'User::Email::Validate']
    },
    password: {
        type: String,
        required: [true, 'User::Password::Required'],
        minlength: [8, 'User::Password::MinLength'],
        maxlength: [16, 'User::Password::MaxLength'],
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
        minlength: [4, 'User::FirstName::MinLength'],
        maxlength: [16, 'User::FirstName::MaxLength'],
        required: [true, 'User::Username::Required'],
        lowercase: true,
        trim: true
    },
    lastName: {
        type: String,
        minlength: [4, 'User::LastName::MinLength'],
        maxlength: [16, 'User::LastName::MaxLength'],
        required: [true, 'User::LastName::Required'],
        lowercase: true,
        trim: true
    }
}, {
    timestamps: true
});

UserSchema.index({ email: 'text' });

UserSchema.pre<any>('findOneAndDelete', async function(next: HookNextFunction) {
    const userToDelete = await this.model.findOne(this.getFilter());
    if(!userToDelete) return next();

    await Trajectory.deleteMany({ owner: userToDelete._id });
    await Trajectory.updateMany(
        { sharedWith: userToDelete._id },
        { $pull: { sharedWith: userToDelete._id } }
    );

    await Notification.deleteMany({ recipient: userToDelete._id });
    
    next();
});

UserSchema.pre('save', async function(this: IUser & { isNew: boolean }, next: HookNextFunction) {
    if(!this.isModified('password')) return next();

    this.password = await bcrypt.hash(this.password, 12);

    if(!this.isNew){
        this.passwordChangedAt = new Date(Date.now() - 1000);
    }

    next();
});

UserSchema.methods.isCorrectPassword = function(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.isPasswordChangedAfterJWFWasIssued = function(jwtTimestamp: number): boolean {
    if(this.passwordChangedAt){
        const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return jwtTimestamp < changedTimestamp;
    }
    return false;
};

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);

export default User;