import { Document } from 'mongoose';

export interface IUser extends Document {
    email: string;
    password: string;
    role: 'user' | 'admin';
    passwordChangedAt?: Date;
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;

    isCorrectPassword(candidatePassword: string, userPassword: string): Promise<boolean>;
    isPasswordChangedAfterJWFWasIssued(JWTTimeStamp: number): boolean;
}
