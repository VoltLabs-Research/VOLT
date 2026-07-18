import { ErrorCodes } from '@core/constants/error-codes';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import type { ITeamAIIntegrationRepository } from '@modules/team/ports/ai-integration/ITeamAIIntegrationRepository';
import type { ITeamAIProviderCatalog } from '@modules/team/ports/ai-integration/ITeamAIProviderCatalog';
import TeamAIIntegration from '@modules/team/entities/ai-integration/TeamAIIntegration';
import TeamAIIntegrationSecretCipher from '@modules/team/security/ai-integration/TeamAIIntegrationSecretCipher';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { container as diContainer } from 'tsyringe';
import type { TeamAIIntegrationMutationInput } from '@volt/contracts/modules/team/http';
import type {
    GetTeamAIIntegrationsResponse,
    GetTeamAIIntegrationModelsResponse,
    TeamAIIntegrationItem,
    TeamAIIntegrationMutationResponse,
    TeamAIProviderModels,
    TeamAIModelListItem
} from '@volt/contracts/modules/team/domain';

/**
 * The single application service for the team ai-integration resource. Folds
 * the former list/models/create/update/delete use-cases plus the shared
 * item-DTO mapper. The integration repository is a shared singleton (the AI
 * module's SDK transport resolves it to read a team's active provider secrets),
 * so this service resolves it once from the DI container, along with the
 * provider catalog and the (stateless) secret cipher.
 */
export default class TeamAIIntegrationService {
    #integrations = diContainer.resolve<ITeamAIIntegrationRepository>(TEAM_TOKENS.TeamAIIntegrationRepository);
    #providerCatalog = diContainer.resolve<ITeamAIProviderCatalog>(TEAM_TOKENS.TeamAIProviderCatalog);
    #secretCipher = diContainer.resolve(TeamAIIntegrationSecretCipher);

    async listByTeamId(teamId: string): Promise<GetTeamAIIntegrationsResponse> {
        const integrations = await this.#integrations.listByTeamId(teamId);
        return {
            teamId,
            integrations: integrations.map((integration) => this.#toItem(integration)),
            providers: this.#providerCatalog.getAllProviderMetadata()
        };
    }

    async listModels(teamId: string): Promise<GetTeamAIIntegrationModelsResponse> {
        const integrations = await this.#integrations.listEnabledByTeamIdWithSecrets(teamId);

        const providers: TeamAIProviderModels[] = [];
        const models: TeamAIModelListItem[] = [];

        for (const integration of integrations) {
            const providerMeta = this.#providerCatalog.getProviderMetadata(integration.props.provider);
            const enabledModels = integration.props.enabledModels ?? [];
            const providerModels = enabledModels.map((m) => ({ id: m.id, name: m.name }));

            providers.push({
                provider: integration.props.provider,
                providerName: providerMeta.name,
                defaultModel: integration.props.defaultModel,
                metadata: integration.props.metadata,
                models: providerModels
            });

            providerModels.forEach((model) => {
                models.push({
                    ...model,
                    provider: integration.props.provider,
                    providerName: providerMeta.name,
                    isDefault: integration.props.defaultModel === model.id
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

        const existing = await this.#integrations.findOne({ team: teamId, provider });
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

        const persisted = await this.#integrations.create(TeamAIIntegration.create({
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

        const existing = await this.#integrations.findByTeamAndProviderWithSecret(teamId, provider);
        if (!existing) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'AI integration not found for this provider');
        }

        const apiKey = input.apiKey?.trim();
        const encryptedApiKey = apiKey
            ? await this.#secretCipher.encrypt(apiKey)
            : existing.props.encryptedApiKey || await this.#secretCipher.encrypt('ollama-local');

        const defaultModel = input.defaultModel?.trim() || existing.props.defaultModel || null;
        if (!defaultModel) {
            throw ApplicationError.badRequest(ErrorCodes.TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED, 'Default model is required');
        }

        const metadata = input.metadata ?? existing.props.metadata;
        const enabledModels = input.enabledModels
            ? input.enabledModels
                .map(({ id, name }) => ({ id: id.trim(), name: name.trim() }))
                .filter(({ id, name }) => id.length > 0 && name.length > 0)
            : existing.props.enabledModels || [];

        const persisted = await this.#integrations.updateById(existing._id, existing.buildUpdatePayload({
            encryptedApiKey,
            isEnabled: input.isEnabled ?? existing.props.isEnabled,
            defaultModel,
            enabledModels,
            metadata
        }));

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

        const integration = await this.#integrations.findOne({ team: teamId, provider });
        if (!integration) {
            throw ApplicationError.notFound(ErrorCodes.TEAM_AI_INTEGRATION_NOT_FOUND, 'Team AI integration not found');
        }

        await this.#integrations.deleteByTeamAndProvider(teamId, provider);
    }

    #toItem(integration: TeamAIIntegration): TeamAIIntegrationItem {
        const providerMetadata = this.#providerCatalog.getProviderMetadata(integration.props.provider);
        return {
            _id: integration._id,
            teamId: integration.getTeamId(),
            provider: integration.props.provider,
            providerName: providerMetadata.name,
            isEnabled: integration.props.isEnabled,
            defaultModel: integration.props.defaultModel,
            enabledModels: integration.props.enabledModels || [],
            metadata: integration.props.metadata,
            hasApiKey: true,
            createdBy: integration.getCreatedById(),
            createdAt: integration.props.createdAt as unknown as string,
            updatedAt: integration.props.updatedAt as unknown as string
        };
    }
}
