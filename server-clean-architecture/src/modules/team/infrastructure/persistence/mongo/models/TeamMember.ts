import mongoose, { Schema, Model, Document } from 'mongoose';
import { TeamMemberProps } from '@/src/modules/team/domain/entities/TeamMember';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';

type TeamMemberRelations = 'team' | 'user' | 'role';

export interface TeamMemberDocument extends Persistable<TeamMemberProps, TeamMemberRelations>, Document{}

const TeamMemberSchema: Schema<TeamMemberDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        cascade: 'delete'
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

TeamMemberSchema.index({ team: 1, user: 1 }, { unique: true });
TeamMemberSchema.index({ team: 1 });
TeamMemberSchema.index({ user: 1 });

const TeamMember: Model<TeamMemberDocument> = mongoose.model<TeamMemberDocument>('TeamMember', TeamMemberSchema);

export default TeamMember;