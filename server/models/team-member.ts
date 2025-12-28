import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITeamMember extends Document {
    team: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    role: mongoose.Types.ObjectId;
    joinedAt: Date;
}

const TeamMemberSchema = new Schema({
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

TeamMemberSchema.index({ team: 1, user: 1 }, { unique: true });
TeamMemberSchema.index({ team: 1 });
TeamMemberSchema.index({ user: 1 });

const TeamMember: Model<ITeamMember> = mongoose.model<ITeamMember>('TeamMember', TeamMemberSchema);

export default TeamMember;
