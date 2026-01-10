import mongoose, { Schema, Document, Model } from 'mongoose';
import { TeamRoleProps } from '@/src/modules/team/domain/entities/TeamRole';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type TeamRoleRelations = 'team';

export interface TeamRoleDocument extends Persistable<TeamRoleProps, TeamRoleRelations>, Document{}

const TeamRoleSchema: Schema<TeamRoleDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        cascade: 'delete'
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
TeamRoleSchema.index({ name: 'text' });

const TeamRole: Model<TeamRoleDocument> = mongoose.model<TeamRoleDocument>('TeamRole', TeamRoleSchema);

export default TeamRole;