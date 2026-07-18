import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Model, Document } from 'mongoose';

export interface PopulatedTeamMemberUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
    lastSeenAt?: Date;
    createdAt?: Date;
    isOnline?: boolean;
}

export interface PopulatedTeamMemberRole {
    _id: string;
    name?: string;
    permissions?: string[];
    isSystem?: boolean;
}

export interface TeamMemberProps {
    team: string | mongoose.Types.ObjectId | { _id: string };
    user: string | mongoose.Types.ObjectId | PopulatedTeamMemberUser;
    role: string | mongoose.Types.ObjectId | PopulatedTeamMemberRole;
    joinedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export const isPopulatedTeamMemberUser = (value: TeamMemberProps['user']): value is PopulatedTeamMemberUser => (
    typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)
);

export const isPopulatedTeamMemberRole = (value: TeamMemberProps['role']): value is PopulatedTeamMemberRole => (
    typeof value === 'object' && !(value instanceof mongoose.Types.ObjectId)
);

export const getTeamMemberUserId = (value: TeamMemberProps['user']): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    return value._id;
};

export const getTeamMemberRolePermissions = (value: TeamMemberProps['role']): string[] => {
    if (!isPopulatedTeamMemberRole(value)) {
        return [];
    }

    return value.permissions ?? [];
};

type TeamMemberRelations = 'team' | 'user' | 'role';

export interface TeamMemberDocument extends Persistable<TeamMemberProps, TeamMemberRelations>, Document{};

const TeamMemberSchema: Schema<TeamMemberDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: Schema.Types.ObjectId,
        ref: 'TeamRole',
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

TeamMemberSchema.index({
    team: 1,
    user: 1
}, { unique: true });

TeamMemberSchema.index({ team: 1 });

TeamMemberSchema.index({ user: 1 });

const TeamMemberModel: Model<TeamMemberDocument> = mongoose.model<TeamMemberDocument>('TeamMember', TeamMemberSchema);

export default TeamMemberModel;
