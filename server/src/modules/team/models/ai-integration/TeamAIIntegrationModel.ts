export type { EnabledModel } from '@volt/contracts/modules/team/domain';
import type { EnabledModel } from '@volt/contracts/modules/team/domain';
import type { AIProvider } from '@shared/contracts/types/AIProviders';
import type { Persistable } from '@shared/infrastructure/persistence/mongo/MongoUtils';
import mongoose, { Schema, Document, Model } from 'mongoose';

export type TeamAIProvider = AIProvider;

type TeamAIIntegrationRef = string | mongoose.Types.ObjectId | { _id?: unknown; toString?: () => string };

export interface TeamAIIntegrationProps {
    team: string | mongoose.Types.ObjectId;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel?: string;
    enabledModels?: EnabledModel[];
    metadata?: Record<string, unknown>;
    createdBy: TeamAIIntegrationRef;
    createdAt: Date;
    updatedAt: Date;
}

const getTeamAIIntegrationRefId = (value: TeamAIIntegrationRef): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value instanceof mongoose.Types.ObjectId) {
        return value.toString();
    }

    if (typeof value._id === 'string') {
        return value._id;
    }

    return value.toString?.() ?? '';
};

export const getTeamAIIntegrationTeamId = (integration: Pick<TeamAIIntegrationProps, 'team'>): string => (
    getTeamAIIntegrationRefId(integration.team)
);

export const getTeamAIIntegrationCreatedById = (integration: Pick<TeamAIIntegrationProps, 'createdBy'>): string => (
    getTeamAIIntegrationRefId(integration.createdBy)
);

const deduplicateEnabledModels = (models: EnabledModel[]): EnabledModel[] => (
    [...new Map(models.map((model) => [model.id, model])).values()]
);

export const buildTeamAIIntegrationCreatePayload = (input: {
    teamId: string;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata?: Record<string, unknown>;
    userId: string;
    now?: Date;
}): Partial<TeamAIIntegrationProps> => {
    const now = input.now ?? new Date();

    return {
        team: input.teamId,
        provider: input.provider,
        encryptedApiKey: input.encryptedApiKey,
        isEnabled: input.isEnabled,
        defaultModel: input.defaultModel,
        enabledModels: deduplicateEnabledModels(input.enabledModels),
        metadata: input.metadata,
        createdBy: input.userId,
        createdAt: now,
        updatedAt: now
    };
};

export const buildTeamAIIntegrationUpdatePayload = (input: {
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata?: Record<string, unknown>;
    now?: Date;
}): Partial<TeamAIIntegrationProps> => {
    return {
        encryptedApiKey: input.encryptedApiKey,
        isEnabled: input.isEnabled,
        defaultModel: input.defaultModel,
        enabledModels: deduplicateEnabledModels(input.enabledModels),
        metadata: input.metadata,
        updatedAt: input.now ?? new Date()
    };
};

type TeamAIIntegrationRelations = 'team' | 'createdBy';

export interface TeamAIIntegrationDocument extends Persistable<TeamAIIntegrationProps, TeamAIIntegrationRelations>, Document {};

const TeamAIIntegrationSchema: Schema<TeamAIIntegrationDocument> = new Schema({
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true
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
