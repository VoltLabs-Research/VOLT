import mongoose, { Schema, Model, Document } from 'mongoose';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { TeamProps } from '@/src/modules/team/domain/entities/Team';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type TeamRelations = 'owner' | 'admins' | 'members' | 'invitations' | 'containers' | 'trajectories' | 'chats' | 'plugins';

export interface TeamDocument extends Persistable<TeamProps, TeamRelations>, Document{}

const TeamSchema: Schema<TeamDocument> = new Schema({
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

const Team: Model<TeamDocument> = mongoose.model<TeamDocument>('Team', TeamSchema);

export default Team;