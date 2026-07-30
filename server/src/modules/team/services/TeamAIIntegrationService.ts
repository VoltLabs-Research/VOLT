import { ErrorCodes } from '@core/constants/error-codes';
import TeamAIIntegrationEntity from '@modules/team/models/TeamAIIntegration';
import {
    buildTeamAIIntegrationCreatePayload,
    buildTeamAIIntegrationUpdatePayload
} from '@modules/team/contracts/team-ai-integration';
import TeamAIProviderCatalog from '@modules/team/services/ai-integration/TeamAIProviderCatalog';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { decrypt, encrypt } from '@shared/infrastructure/utilities/crypto';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';
import type {
    GetTeamAIIntegrationsResponse,
    GetTeamAIIntegrationModelsResponse,
    TeamAIIntegration,
    TeamAIIntegrationMutationResponse,
    TeamAIProviderModels,
    TeamAIModelListItem
} from '@volt/contracts/modules/team/domain';

class TeamAIIntegrationSecretCipher{
    async encrypt(value: string): Promise<string>{
        return encrypt(value);
    }

    async decrypt(value: string): Promise<string>{
        return decrypt(value);
    }
}

export default class TeamAIIntegrationService{
    #providerCatalog = new TeamAIProviderCatalog();
    #secretCipher = new TeamAIIntegrationSecretCipher();

    async listByTeamId(teamId: string): Promise<GetTeamAIIntegrationsResponse>{
        const integrations = await TeamAIIntegrationEntity.find({
            where: { team: teamId },
            order: { createdAt: 'DESC' }
        });

        return {
            teamId,
            integrations: integrations.map((integration) => this.#toItem(integration)),
            providers: this.#providerCatalog.getAllProviderMetadata()
        };
    }

    async listModels(teamId: string): Promise<GetTeamAIIntegrationModelsResponse>{
        const integrations = await TeamAIIntegrationEntity.find({
            where: {
                team: teamId,
                isEnabled: true
            },
            order: { createdAt: 'DESC' }
        });

        const providers: TeamAIProviderModels[] = [];
        const models: TeamAIModelListItem[] = [];

        for(const integration of integrations){
            const providerMeta = this.#providerCatalog.getProviderMetadata(integration.provider);
            const enabledModels = integration.enabledModels ?? [];
            const providerModels = enabledModels.map((model) => ({
                id: model.id,
                name: model.name
            }));

            providers.push({
                provider: integration.provider,
                providerName: providerMeta.name,
                defaultModel: integration.defaultModel ?? undefined,
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

        return {
            teamId,
            providers,
            models
        };
    }

    async createByProvider(teamId: string, userId: string, providerRaw: string, input: TeamAIIntegrationMutationInput): Promise<TeamAIIntegrationMutationResponse>{
        const provider = this.#providerCatalog.normalize(providerRaw);
        if(!provider){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const existing = await TeamAIIntegrationEntity.findOneBy({
            team: teamId,
            provider
        });
        if(existing){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_ALREADY_EXISTS, 'An integration for this provider already exists in this team');
        }

        const requiresApiKey = provider !== 'ollama';
        const providedApiKey = input.apiKey?.trim();
        if(requiresApiKey && !providedApiKey){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_API_KEY_REQUIRED, 'API key is required for new integration');
        }

        const defaultModel = input.defaultModel?.trim() || null;
        if(!defaultModel){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED, 'Default model is required');
        }

        const encryptedApiKey = await this.#secretCipher.encrypt(providedApiKey || 'ollama-local');
        const enabledModels = (input.enabledModels ?? [])
            .map(({ id, name }) => ({
                id: id.trim(),
                name: name.trim()
            }))
            .filter(({ id, name }) => id.length > 0 && name.length > 0);

        const persisted = await TeamAIIntegrationEntity.create(buildTeamAIIntegrationCreatePayload({
            teamId,
            provider,
            encryptedApiKey,
            isEnabled: input.isEnabled ?? true,
            defaultModel,
            enabledModels,
            metadata: input.metadata,
            userId
        })).save();

        return { integration: this.#toItem(persisted) };
    }

    async updateByProvider(teamId: string, providerRaw: string, input: TeamAIIntegrationMutationInput): Promise<TeamAIIntegrationMutationResponse>{
        const provider = this.#providerCatalog.normalize(providerRaw);
        if(!provider){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const existing = await TeamAIIntegrationEntity.findOneBy({
            team: teamId,
            provider
        });
        if(!existing){
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'AI integration not found for this provider');
        }

        const apiKey = input.apiKey?.trim();
        const encryptedApiKey = apiKey
            ? await this.#secretCipher.encrypt(apiKey)
            : existing.encryptedApiKey || await this.#secretCipher.encrypt('ollama-local');

        const defaultModel = input.defaultModel?.trim() || existing.defaultModel || null;
        if(!defaultModel){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED, 'Default model is required');
        }

        const metadata = input.metadata ?? existing.metadata;
        const enabledModels = input.enabledModels
            ? input.enabledModels
                .map(({ id, name }) => ({
                    id: id.trim(),
                    name: name.trim()
                }))
                .filter(({ id, name }) => id.length > 0 && name.length > 0)
            : existing.enabledModels || [];

        const persisted = await Object.assign(existing, buildTeamAIIntegrationUpdatePayload({
            encryptedApiKey,
            isEnabled: input.isEnabled ?? existing.isEnabled,
            defaultModel,
            enabledModels,
            metadata
        })).save();

        return { integration: this.#toItem(persisted) };
    }

    async deleteByProvider(teamId: string, providerRaw: string): Promise<void>{
        const provider = this.#providerCatalog.normalize(providerRaw);
        if(!provider){
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED, 'Provider is not supported');
        }

        const integration = await TeamAIIntegrationEntity.findOneBy({
            team: teamId,
            provider
        });
        if(!integration){
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'Team AI integration not found');
        }

        await TeamAIIntegrationEntity.delete({
            team: teamId,
            provider
        });
    }

    #toItem(integration: TeamAIIntegrationEntity): TeamAIIntegration{
        const providerMetadata = this.#providerCatalog.getProviderMetadata(integration.provider);
        return {
            _id: integration.id,
            teamId: integration.team,
            provider: integration.provider,
            providerName: providerMetadata.name,
            isEnabled: integration.isEnabled,
            defaultModel: integration.defaultModel ?? undefined,
            enabledModels: integration.enabledModels || [],
            metadata: integration.metadata,
            hasApiKey: true,
            createdBy: integration.createdBy,
            createdAt: integration.createdAt as unknown as string,
            updatedAt: integration.updatedAt as unknown as string
        };
    }
}
