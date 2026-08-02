import { ErrorCodes } from '@core/constants/error-codes';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import { buildLanguageModel } from '@modules/ai/services/ProviderRegistry';
import type { ResolvedModel } from '@modules/ai/contracts/provider';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { decrypt } from '@shared/infrastructure/utilities/crypto';

export default class ModelResolver{
    async resolve(teamId: string, requestedProvider?: string, requestedModel?: string): Promise<ResolvedModel>{
        const integration = await this.#findIntegration(teamId, requestedProvider);
        const modelName = requestedModel || integration.defaultModel;

        if(!modelName){
            throw ApplicationError.badRequest(
                ErrorCodes.AI_PROVIDER_UNAVAILABLE,
                `No model specified and provider "${integration.provider}" has no default model configured`
            );
        }

        const baseUrl = integration.metadata?.baseUrl;

        return {
            model: buildLanguageModel(integration.provider, modelName, {
                apiKey: integration.encryptedApiKey ? await decrypt(integration.encryptedApiKey) : '',
                baseURL: typeof baseUrl === 'string' ? baseUrl : undefined
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
}
