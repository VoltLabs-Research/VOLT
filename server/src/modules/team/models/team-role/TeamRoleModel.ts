import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Document, Model } from 'mongoose';

export interface TeamRoleProps{
    team: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export const canRenameTeamRoleTo = (role: Pick<TeamRoleProps, 'name' | 'isSystem'>, name?: string): boolean => {
    if (!name) {
        return true;
    }

    if (!role.isSystem) {
        return true;
    }

    return name === role.name;
};

export const buildTeamRoleUpdatePayload = (
    role: Pick<TeamRoleProps, 'isSystem'>,
    input: Partial<Pick<TeamRoleProps, 'name' | 'permissions'>>
): Partial<TeamRoleProps> => {
    if (role.isSystem) {
        return {
            permissions: input.permissions
        };
    }

    return {
        name: input.name,
        permissions: input.permissions
    };
};

export const buildTeamRoleCreatePayload = (input: {
    teamId: string;
    name: string;
    permissions: string[];
    isSystem: boolean;
    now?: Date;
}): Partial<TeamRoleProps> => {
    const now = input.now ?? new Date();

    return {
        team: input.teamId,
        name: input.name,
        permissions: [...new Set(input.permissions)],
        isSystem: input.isSystem,
        createdAt: now,
        updatedAt: now
    };
};

type TeamRoleRelations = 'team';

export interface TeamRoleDocument extends Persistable<TeamRoleProps, TeamRoleRelations>, Document{};

const TeamRoleSchema: Schema<TeamRoleDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    permissions: [{
        type: String
    }],
    isSystem: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

TeamRoleSchema.index({
    team: 1,
    name: 1
}, { unique: true });

TeamRoleSchema.index({ team: 1, isSystem: 1 });

TeamRoleSchema.index({ name: 'text' });

const TeamRoleModel: Model<TeamRoleDocument> = mongoose.model<TeamRoleDocument>('TeamRole', TeamRoleSchema);

export default TeamRoleModel;
