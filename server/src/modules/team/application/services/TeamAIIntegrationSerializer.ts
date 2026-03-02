import { injectable, inject } from 'tsyringe';
import TeamAIIntegration from '@modules/team/domain/entities/TeamAIIntegration';
import TeamAIProviderCatalog from '@modules/team/application/services/TeamAIProviderCatalog';
import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';

@injectable()
export default class TeamAIIntegrationSerializer {
    constructor(
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: TeamAIProviderCatalog
    ) {}

    toDTO(integration: TeamAIIntegration): TeamAIIntegrationItemDTO {
        const providerMetadata = this.providerCatalog.getProviderMetadata(integration.props.provider);

        return {
            _id: integration.id,
            teamId: String(integration.props.team),
            provider: integration.props.provider,
            providerName: providerMetadata.name,
            isEnabled: integration.props.isEnabled,
            defaultModel: integration.props.defaultModel,
            enabledModels: integration.props.enabledModels || [],
            metadata: integration.props.metadata,
            hasApiKey: true,
            createdBy: integration.props.createdBy,
            createdAt: integration.props.createdAt,
            updatedAt: integration.props.updatedAt
        };
    }
};
