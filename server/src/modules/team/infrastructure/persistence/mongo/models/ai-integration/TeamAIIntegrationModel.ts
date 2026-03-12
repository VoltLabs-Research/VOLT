import type { TeamAIIntegrationProps } from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Document, Model } from 'mongoose';

enum TeamAIIntegrationRelation {
    Team = 'team',
    CreatedBy = 'createdBy'
};

type TeamAIIntegrationRelations = `${TeamAIIntegrationRelation}`;

export interface TeamAIIntegrationDocument extends Persistable<TeamAIIntegrationProps, TeamAIIntegrationRelations>, Document {};

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
        type: [{
            id: { type: String, required: true },
            name: { type: String, required: true },
            _id: false
        }],
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

TeamAIIntegrationSchema.index({
    team: 1,
    provider: 1
}, { unique: true });

TeamAIIntegrationSchema.index({ team: 1, isEnabled: 1 });

const TeamAIIntegrationModel: Model<TeamAIIntegrationDocument> = mongoose.model<TeamAIIntegrationDocument>('TeamAIIntegration', TeamAIIntegrationSchema);

export default TeamAIIntegrationModel;
