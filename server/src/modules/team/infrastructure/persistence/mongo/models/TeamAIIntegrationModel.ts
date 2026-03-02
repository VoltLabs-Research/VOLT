import mongoose, { Schema, Document, Model } from 'mongoose';
import { TeamAIIntegrationProps } from '@modules/team/domain/entities/TeamAIIntegration';
import { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';

type TeamAIIntegrationRelations = 'team' | 'createdBy';

export interface TeamAIIntegrationDocument extends Persistable<TeamAIIntegrationProps, TeamAIIntegrationRelations>, Document {}

const TeamAIIntegrationSchema: Schema<TeamAIIntegrationDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        cascade: 'delete'
    },
    provider: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    encryptedApiKey: {
        type: String,
        required: true,
        select: false
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    defaultModel: {
        type: String,
        trim: true
    },
    enabledModels: {
        type: [String],
        default: []
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

TeamAIIntegrationSchema.index({ team: 1, provider: 1 }, { unique: true });
TeamAIIntegrationSchema.index({ team: 1, isEnabled: 1 });

const TeamAIIntegrationModel: Model<TeamAIIntegrationDocument> = mongoose.model<TeamAIIntegrationDocument>('TeamAIIntegration', TeamAIIntegrationSchema);

export default TeamAIIntegrationModel;
