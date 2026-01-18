import mongoose, { Schema, Model, Document, Types } from 'mongoose';
import { ValidationCodes } from '../../../../../../core/constants/validation-codes';
import { SessionActivityType, SessionProps } from '../../../../domain/entities/Session';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type SimulationCellRelations = 'user';

export interface SessionDocument extends Persistable<SessionProps, SimulationCellRelations>, Document { }

const SessionSchema: Schema<SessionDocument> = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [
            function(this){
                return this.action !== SessionActivityType.FailedLogin;
            },
            ValidationCodes.SESSION_SUCCESS_REQUIRED
        ]
    },
    token: {
        type: String,
        required: [
            function(this){
                return this.action !== SessionActivityType.FailedLogin
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
    action: {
        type: String,
        required: [true, ValidationCodes.SESSION_ACTION_REQUIRED],
        enum: Object.values(SessionActivityType),
        default: SessionActivityType.Login
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

/**
 * NOTE: Unique token only when token is a string (skip null/undefned for failed logins)
 */
SessionSchema.index(
    { token: 1 },
    { unique: true, partialFilterExpression: { token: { $type: 'string' } } }
);

SessionSchema.index({ lastActivity: -1 });
SessionSchema.index({ action: 1, createdAt: -1 });
SessionSchema.index({ success: 1, createdAt: -1 });

const SessionModel: Model<SessionDocument> = mongoose.model<SessionDocument>('Session', SessionSchema);

export default SessionModel;