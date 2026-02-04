import mongoose, { Schema, Model } from 'mongoose';
import crypto from 'crypto';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import { ValidationCodes } from '@/constants/validation-codes';

export interface ITeamInvitation extends Document {
    team: mongoose.Types.ObjectId;
    invitedBy: mongoose.Types.ObjectId;
    invitedUser: mongoose.Types.ObjectId;
    email: string;
    token: string;
    role: 'Can view' | 'Can edit' | 'Full access';
    expiresAt: Date;
    acceptedAt?: Date;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: Date;
    updatedAt: Date;
}

const TeamInvitationSchema: Schema<ITeamInvitation> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: [true, ValidationCodes.TEAM_INVITATION_TEAM_REQUIRED],
        inverse: { path: 'invitations', behavior: 'addToSet' },
        cascade: 'delete',
        index: true
    },
    invitedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.TEAM_INVITATION_INVITED_BY_REQUIRED]
    },
    invitedUser: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    email: {
        type: String,
        required: [true, ValidationCodes.TEAM_INVITATION_EMAIL_REQUIRED],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, ValidationCodes.TEAM_INVITATION_EMAIL_INVALID],
        index: true
    },
    token: {
        type: String,
        required: [true, ValidationCodes.TEAM_INVITATION_TOKEN_REQUIRED],
        unique: true,
        index: true
    },
    role: {
        type: String,
        enum: {
            values: ['Can view', 'Can edit', 'Full access'],
            message: ValidationCodes.TEAM_INVITATION_ROLE_INVALID
        },
        default: 'Can view',
        required: true
    },
    expiresAt: {
        type: Date,
        required: [true, ValidationCodes.TEAM_INVITATION_EXPIRES_AT_REQUIRED]
    },
    acceptedAt: {
        type: Date
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'accepted', 'rejected'],
            message: ValidationCodes.TEAM_INVITATION_STATUS_INVALID
        },
        default: 'pending',
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// Generate token before saving
TeamInvitationSchema.pre('save', function (next) {
    if (!this.isNew) return next();

    const token = crypto.randomBytes(32).toString('hex');
    this.token = token;
    this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    next();
});

// TTL index to automatically delete expired invitations after 24 hours + 1 day
TeamInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

TeamInvitationSchema.plugin(useCascadeDelete);

const TeamInvitation: Model<ITeamInvitation> = mongoose.model<ITeamInvitation>('TeamInvitation', TeamInvitationSchema);

export default TeamInvitation;
