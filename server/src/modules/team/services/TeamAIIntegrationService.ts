import { ErrorCodes } from '@core/constants/error-codes';
import TeamAIIntegrationModel, {
    buildTeamAIIntegrationCreatePayload,
    buildTeamAIIntegrationUpdatePayload,
    getTeamAIIntegrationCreatedById,
    getTeamAIIntegrationTeamId
} from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import type { TeamAIIntegrationDocument } from '@modules/team/models/ai-integration/TeamAIIntegrationModel';
import TeamAIProviderCatalog from '@modules/team/services/ai-integration/TeamAIProviderCatalog';
import TeamAIIntegrationSecretCipher from '@modules/team/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { HydratedDocument } from 'mongoose';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';
import type {
    GetTeamAIIntegrationsResponse,
    GetTeamAIIntegrationModelsResponse,
    TeamAIIntegrationItem,
    TeamAIIntegrationMutationResponse,
    TeamAIProviderModels,
    TeamAIModelListItem
} from '@volt/contracts/modules/team/domain';

type TeamAIIntegrationDoc = HydratedDocument<TeamAIIntegrationDocument>;

export default class TeamAIIntegrationService {
    #providerCatalog = new TeamAIProviderCatalog();
    #secretCipher = new TeamAIIntegrationSecretCipher();

    async listByTeamId(teamId: string): Promise<GetTeamAIIntegrationsResponse> {
        const integrations = await TeamAIIntegrationModel.find({ team: teamId }).sort({ createdAt: -1 });
        return {
            teamId,
            integrations: integrations.map((integration) => this.#toItem(integration)),
            providers: this.#providerCatalog.getAllProviderMetadata()
        };
    }

    async listModels(teamId: string): Promise<GetTeamAIIntegrationModelsResponse> {
        const integrations = await TeamAIIntegrationModel.find({ team: teamId, isEnabled: true })
            .select('+encryptedApiKey')
            .sort({ createdAt: -1 });

        const providers: TeamAIProviderModels[] = [];
        const models: TeamAIModelListItem[] = [];

        for (const integration of integrations) {
            const providerMeta = this.#providerCatalog.getProviderMetadata(integration.provider);
            const enabledModels = integration.enabledModels ?? [];
            const providerModels = enabledModels.map((m) => ({ id: m.id, name: m.name }));

            providers.push({
                provider: integration.provider,
                providerName: providerMeta.name,
                defaultModel: integration.defaultModel,
                metadata: integration.metadata,
                models: providerModels
            });

            providerModels.forEach((model) => {
                models.push({
                    ...model,
                    provider: integration.provider,
                    providerName: providerMeta.name,
                    isDefault: integration.defaultModel === model.id
                });
            });
        }

        return { teamId, providers, models };
    }

    async createByProvider(teamId: string, userId: string, providerRaw: string, input: TeamAIIntegrationMutationInput): Promise<TeamAIIntegrationMutationResponse> {
        const provider = this.#providerCatalog.normalize(providerRaw);
        if (!provider) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const existing = await TeamAIIntegrationModel.findOne({ team: teamId, provider });
        if (existing) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_ALREADY_EXISTS, 'An integration for this provider already exists in this team');
        }

        const requiresApiKey = provider !== 'ollama';
        const providedApiKey = input.apiKey?.trim();
        if (requiresApiKey && !providedApiKey) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_API_KEY_REQUIRED, 'API key is required for new integration');
        }

        const defaultModel = input.defaultModel?.trim() || null;
        if (!defaultModel) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED, 'Default model is required');
        }

        const encryptedApiKey = await this.#secretCipher.encrypt(providedApiKey || 'ollama-local');
        const enabledModels = (input.enabledModels ?? [])
            .map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
            .filter(({ id, name }) => id.length > 0 && name.length > 0);

        const persisted = await TeamAIIntegrationModel.create(buildTeamAIIntegrationCreatePayload({
            teamId,
            provider,
            encryptedApiKey,
            isEnabled: input.isEnabled ?? true,
            defaultModel,
            enabledModels,
            metadata: input.metadata,
            userId
        }));

        return { integration: this.#toItem(persisted) };
    }

    async updateByProvider(teamId: string, providerRaw: string, input: TeamAIIntegrationMutationInput): Promise<TeamAIIntegrationMutationResponse> {
        const provider = this.#providerCatalog.normalize(providerRaw);
        if (!provider) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const existing = await TeamAIIntegrationModel.findOne({ team: teamId, provider }).select('+encryptedApiKey');
        if (!existing) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'AI integration not found for this provider');
        }

        const apiKey = input.apiKey?.trim();
        const encryptedApiKey = apiKey
            ? await this.#secretCipher.encrypt(apiKey)
            : existing.encryptedApiKey || await this.#secretCipher.encrypt('ollama-local');

        const defaultModel = input.defaultModel?.trim() || existing.defaultModel || null;
        if (!defaultModel) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED, 'Default model is required');
        }

        const metadata = input.metadata ?? existing.metadata;
        const enabledModels = input.enabledModels
            ? input.enabledModels
                .map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
                .filter(({ id, name }) => id.length > 0 && name.length > 0)
            : existing.enabledModels || [];

        const persisted = await TeamAIIntegrationModel.findByIdAndUpdate(
            existing._id,
            { $set: buildTeamAIIntegrationUpdatePayload({
                encryptedApiKey,
                isEnabled: input.isEnabled ?? existing.isEnabled,
                defaultModel,
                enabledModels,
                metadata
            }) },
            { new: true }
        );

        if (!persisted) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'AI integration could not be updated');
        }

        return { integration: this.#toItem(persisted) };
    }

    async deleteByProvider(teamId: string, providerRaw: string): Promise<void> {
        const provider = this.#providerCatalog.normalize(providerRaw);
        if (!provider) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const integration = await TeamAIIntegrationModel.findOne({ team: teamId, provider });
        if (!integration) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'Team AI integration not found');
        }

        await TeamAIIntegrationModel.deleteOne({ team: teamId, provider });
    }

    #toItem(integration: TeamAIIntegrationDoc): TeamAIIntegrationItem {
        const providerMetadata = this.#providerCatalog.getProviderMetadata(integration.provider);
        return {
            _id: String(integration._id),
            teamId: getTeamAIIntegrationTeamId(integration),
            provider: integration.provider,
            providerName: providerMetadata.name,
            isEnabled: integration.isEnabled,
            defaultModel: integration.defaultModel,
            enabledModels: integration.enabledModels || [],
            metadata: integration.metadata,
            hasApiKey: true,
            createdBy: getTeamAIIntegrationCreatedById(integration),
            createdAt: integration.createdAt as unknown as string,
            updatedAt: integration.updatedAt as unknown as string
        };
    }
}
