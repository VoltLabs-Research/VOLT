import mongoose, { Schema, Document, Model } from 'mongoose';
import { SystemRoles } from '@/constants/system-roles';

export interface ITeamRole extends Document {
    team: mongoose.Types.ObjectId;
    name: string;
    permissions: string[];
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

interface ITeamRoleModel extends Model<ITeamRole> {
    createSystemRolesForTeam(teamId: mongoose.Types.ObjectId): Promise<ITeamRole[]>;
    getOwnerRole(teamId: mongoose.Types.ObjectId): Promise<ITeamRole | null>;
    getDefaultMemberRole(teamId: mongoose.Types.ObjectId): Promise<ITeamRole | null>;
}

const TeamRoleSchema = new Schema({
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

TeamRoleSchema.index({ team: 1, name: 1 }, { unique: true });
TeamRoleSchema.index({ team: 1, isSystem: 1 });

TeamRoleSchema.statics.createSystemRolesForTeam = async function (
    teamId: mongoose.Types.ObjectId
): Promise<ITeamRole[]> {
    const roles = Object.values(SystemRoles).map(role => ({
        team: teamId,
        name: role.name,
        permissions: [...role.permissions],
        isSystem: true
    }));
    return this.insertMany(roles);
};

TeamRoleSchema.statics.getOwnerRole = async function (
    teamId: mongoose.Types.ObjectId
): Promise<ITeamRole | null> {
    return this.findOne({ team: teamId, name: 'Owner', isSystem: true });
};

TeamRoleSchema.statics.getDefaultMemberRole = async function (
    teamId: mongoose.Types.ObjectId
): Promise<ITeamRole | null> {
    return this.findOne({ team: teamId, name: 'Member', isSystem: true });
};

const TeamRole = mongoose.model<ITeamRole, ITeamRoleModel>('TeamRole', TeamRoleSchema);

export default TeamRole;