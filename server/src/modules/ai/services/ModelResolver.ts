import { ErrorCodes } from '@core/constants/error-codes';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import ProviderRegistry from '@modules/ai/services/ProviderRegistry';
import type { ResolvedModel } from '@modules/ai/contracts/domain/provider';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { decrypt } from '@shared/infrastructure/utilities/crypto';

export default class ModelResolver{
    #registry = new ProviderRegistry();

    async resolve(teamId: string, requestedProvider?: string, requestedModel?: string): Promise<ResolvedModel>{
        const integration = await this.#findIntegration(teamId, requestedProvider);
        const modelName = requestedModel || integration.defaultModel;

        if(!modelName){
            throw ApplicationError.badRequest(
                ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                `No model specified and provider "${integration.provider}" has no default model configured`
            );
        }

        return {
            model: this.#registry.build(integration.provider, modelName, {
                apiKey: await this.#readApiKey(integration),
                baseUrl: this.#readBaseUrl(integration)
            }),
            provider: integration.provider,
            modelName
        };
    }

    async #findIntegration(teamId: string, requestedProvider?: string): Promise<TeamAIIntegration>{
        const integrations = await TeamAIIntegration.find({
            where: {
                team: teamId,
                isEnabled: true
            },
            order: { createdAt: 'DESC' }
        });

        if(integrations.length === 0){
            throw ApplicationError.badRequest(
                ErrorCodes.AI_INTEGRATION_NOT_CONFIGURED,
                'No AI provider integrations configured for this team'
            );
        }

        if(!requestedProvider) return integrations[0];

        const requested = integrations.find((integration) => integration.provider === requestedProvider);
        if(!requested){
            throw ApplicationError.badRequest(
                ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                `Provider "${requestedProvider}" is not configured for this team`
            );
        }

        return requested;
    }

    #readApiKey(integration: TeamAIIntegration): Promise<string>{
        return integration.encryptedApiKey ? decrypt(integration.encryptedApiKey) : Promise.resolve('');
    }

    #readBaseUrl(integration: TeamAIIntegration): string | undefined{
        const baseUrl = integration.metadata?.baseUrl;
        return typeof baseUrl === 'string' ? baseUrl : undefined;
    }
}
