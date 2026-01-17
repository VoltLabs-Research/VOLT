import mongoose, { Schema, Model, Document } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { TeamInvitationProps, TeamInvitationStatus } from '@/src/modules/team/domain/entities/TeamInvitation';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type TeamInvitationRelations = 'team' | 'invitedBy' | 'invitedUser' | 'role';

export interface TeamInvitationDocument extends Persistable<TeamInvitationProps, TeamInvitationRelations>, Document{}

const TeamInvitationSchema: Schema<TeamInvitationDocument> = new Schema({
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
        type: Schema.Types.ObjectId,
        ref: 'TeamRole',
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
            values: Object.values(TeamInvitationStatus),
            message: ValidationCodes.TEAM_INVITATION_STATUS_INVALID
        },
        default: TeamInvitationStatus.Pending,
        required: true,
        index: true
    }
}, {
    timestamps: true
});

// TTL index to automatically delete expired invitations after 24 hours + 1 day
TeamInvitationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 });

const TeamInvitationModel: Model<TeamInvitationDocument> = mongoose.model<TeamInvitationDocument>('TeamInvitation', TeamInvitationSchema);

export default TeamInvitationModel;
