import type { AIProvider } from '@shared/contracts/types/AIProviders';
import type { EnabledModel } from '@volt/contracts/modules/team/domain';
export type TeamAIProvider = AIProvider;

interface TeamAIIntegrationCreateInput{
    teamId: string;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata?: Record<string, unknown>;
    userId: string;
}

interface TeamAIIntegrationCreatePayload{
    team: string;
    provider: TeamAIProvider;
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata: Record<string, unknown>;
    createdBy: string;
}

interface TeamAIIntegrationUpdateInput{
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata?: Record<string, unknown>;
}

interface TeamAIIntegrationUpdatePayload{
    encryptedApiKey: string;
    isEnabled: boolean;
    defaultModel: string;
    enabledModels: EnabledModel[];
    metadata: Record<string, unknown>;
}

const deduplicateEnabledModels = (models: EnabledModel[]): EnabledModel[] => (
    [...new Map(models.map((model) => [model.id, model])).values()]
);

export const buildTeamAIIntegrationCreatePayload = (input: TeamAIIntegrationCreateInput): TeamAIIntegrationCreatePayload => ({
    team: input.teamId,
    provider: input.provider,
    encryptedApiKey: input.encryptedApiKey,
    isEnabled: input.isEnabled,
    defaultModel: input.defaultModel,
    enabledModels: deduplicateEnabledModels(input.enabledModels),
    metadata: input.metadata ?? {},
    createdBy: input.userId
});

export const buildTeamAIIntegrationUpdatePayload = (input: TeamAIIntegrationUpdateInput): TeamAIIntegrationUpdatePayload => ({
    encryptedApiKey: input.encryptedApiKey,
    isEnabled: input.isEnabled,
    defaultModel: input.defaultModel,
    enabledModels: deduplicateEnabledModels(input.enabledModels),
    metadata: input.metadata ?? {}
});
