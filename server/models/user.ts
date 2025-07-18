import mongoose, { Schema, Model } from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import Trajectory from '@models/trajectory';
import { IUser } from '@types/models/user';
import { NextFunction } from 'express';

const UserSchema: Schema<any> = new Schema({
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
    passwordResetToken: String,
    passwordResetExpires: Date,
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
    },
    trajectories: [{
        type: Schema.Types.ObjectId,
        ref: 'Trajectory'
    }]
}, {
    timestamps: true
});

UserSchema.index({ email: 'text' });

const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};


UserSchema.pre<any>('findOneAndDelete', async function(next: NextFunction){
    const userToDelete = await this.model.findOne(this.getFilter());
    if(!userToDelete) return next();

    await Trajectory.deleteMany({ owner: userToDelete._id });
    
    await Trajectory.updateMany(
        { sharedWith: userToDelete._id },
        { $pull: { sharedWith: userToDelete._id } }
    );
    
    next();
});

UserSchema.pre('save', async function(next){
    if (!this.isModified('password')) return next();

    this.password = await hashPassword(this.password);

    if(this.isModified('password') && !this.isNew){
        this.passwordChangedAt = new Date();
    }

    next();
});

UserSchema.methods.isCorrectPassword = async function(candidatePassword: string, userPassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.isPasswordChangedAfterJWFWasIssued = function(JWTTimeStamp: number): boolean {
    if(this.passwordChangedAt){
        const changedTimeStamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
        return JWTTimeStamp < changedTimeStamp;
    }
    return false;
};

const User: Model<IUser> = mongoose.model('User', UserSchema);

export default User;