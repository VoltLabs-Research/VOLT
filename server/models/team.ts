import mongoose, { Schema, Model } from 'mongoose';
import { ITeam } from '@/types/models/team';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import { ValidationCodes } from '@/constants/validation-codes';

const TeamSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.TEAM_NAME_REQUIRED],
        trim: true,
        minlength: [3, ValidationCodes.TEAM_NAME_MINLEN],
        maxlength: [50, ValidationCodes.TEAM_NAME_MAXLEN]
    },
    description: {
        type: String,
        trim: true,
        maxlength: [250, ValidationCodes.TEAM_NAME_DESCRIPTION_MAXLEN]
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, ValidationCodes.TEAM_OWNER_REQUIRED]
    },
    admins: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        cascade: 'pull'
    }],
    members: [{
        type: Schema.Types.ObjectId,
        ref: 'User',
        inverse: { path: 'teams', behavior: 'addToSet' },
        cascade: 'pull'
    }],
    invitations: [{
        type: Schema.Types.ObjectId,
        ref: 'TeamInvitation',
        cascade: 'delete'
    }],
    containers: [{
        type: Schema.Types.ObjectId,
        ref: 'Container',
        cascade: 'delete',
        inverse: { path: 'team', behavior: 'set' }
    }],
    trajectories: [{
        type: Schema.Types.ObjectId,
        ref: 'Trajectory',
        inverse: { path: 'team', behavior: 'set' }
    }],
    chats: [{
        type: Schema.Types.ObjectId,
        ref: 'Chat',
        cascade: 'delete',
        inverse: { path: 'team', behavior: 'set' }
    }],
    plugins: [{
        type: Schema.Types.ObjectId,
        ref: 'Plugin',
        inverse: { path: 'team', behavior: 'set' }
    }]
}, {
    timestamps: true
});

TeamSchema.index({ name: 'text', description: 'text' });

TeamSchema.plugin(useCascadeDelete);
TeamSchema.plugin(useInverseRelations);

TeamSchema.post('save', async function (doc) {
    const isNewTeam = this.createdAt.getTime() === this.updatedAt.getTime();
    if (!isNewTeam) return;

    const { SystemRoles } = await import('@/constants/system-roles');
    const TeamRoleModel = mongoose.model('TeamRole');
    const TeamMemberModel = mongoose.model('TeamMember');

    const existingRoles = await TeamRoleModel.countDocuments({ team: doc._id });
    if (existingRoles > 0) return;

    const roles = Object.values(SystemRoles).map(role => ({
        team: doc._id,
        name: role.name,
        permissions: [...role.permissions],
        isSystem: true
    }));
    await TeamRoleModel.insertMany(roles);

    const ownerRole = await TeamRoleModel.findOne({
        team: doc._id,
        name: 'Owner',
        isSystem: true
    });

    if (ownerRole) {
        await TeamMemberModel.create({
            team: doc._id,
            user: doc.owner,
            role: ownerRole._id,
            joinedAt: new Date()
        });
    }
});



const Team: Model<ITeam> = mongoose.model<ITeam>('Team', TeamSchema);

export default Team;

