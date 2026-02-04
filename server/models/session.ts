import { ValidationCodes } from '@/constants/validation-codes';
import mongoose, { Schema, Model } from 'mongoose';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';

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
// Unique token only when token is a string(skip null/undefined for failed logins)
SessionSchema.index({ token: 1 }, { unique: true, partialFilterExpression: { token: { $type: 'string' } } });
SessionSchema.index({ lastActivity: -1 });
SessionSchema.index({ action: 1, createdAt: -1 });
SessionSchema.index({ success: 1, createdAt: -1 });

SessionSchema.plugin(useCascadeDelete);

const Session: Model<ISession> = mongoose.model<ISession>('Session', SessionSchema);

export default Session;
