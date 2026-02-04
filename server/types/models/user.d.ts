import mongoose, { Document } from 'mongoose';
import { ITeam } from '@/models/team/team';

export interface IUser extends Document {
    email: string;
    lastLoginAt?: Date;
    password?: string; // Optional for OAuth users
    role: 'user' | 'admin';
    passwordChangedAt?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    teams: mongoose.Types.ObjectId[] | ITeam[];
    analyses: mongoose.Types.ObjectId[];
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;

    // OAuth fields
    oauthProvider?: 'github' | 'google' | 'microsoft' | null;
    oauthId?: string;
    avatar?: string;

    isCorrectPassword(candidatePassword: string, userPassword: string): Promise<boolean>;
    isPasswordChangedAfterJWFWasIssued(JWTTimeStamp: number): boolean;
}
