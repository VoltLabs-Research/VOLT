import type { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import type TeamAIIntegration from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import type TeamAIProviderCatalog from '@modules/team/infrastructure/services/ai-integration/TeamAIProviderCatalog';

export const toTeamAIIntegrationItemDTO = (
    integration: TeamAIIntegration,
    providerCatalog: TeamAIProviderCatalog
): TeamAIIntegrationItemDTO => {
    const providerMetadata = providerCatalog.getProviderMetadata(integration.props.provider);

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
        createdAt: integration.props.createdAt,
        updatedAt: integration.props.updatedAt
    };
};
