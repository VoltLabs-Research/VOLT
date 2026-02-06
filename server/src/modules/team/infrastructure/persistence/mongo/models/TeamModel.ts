import mongoose, { Schema, Model, Document } from 'mongoose';
import { ValidationCodes } from '@core/constants/validation-codes';
import { TeamProps } from '@modules/team/domain/entities/Team';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type TeamRelations = 'owner';

export interface TeamDocument extends Persistable<TeamProps, TeamRelations>, Document { }

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
    }
}, {
    timestamps: true
});

TeamSchema.index({ name: 'text', description: 'text' });

const TeamModel: Model<TeamDocument> = mongoose.model<TeamDocument>('Team', TeamSchema);

export default TeamModel;