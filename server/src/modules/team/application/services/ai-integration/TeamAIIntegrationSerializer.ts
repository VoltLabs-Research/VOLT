import { TEAM_TOKENS } from '@modules/team/infrastructure/di/TeamTokens';
import { TeamAIIntegrationItemDTO } from '@modules/team/application/dtos/ai-integration/GetTeamAIIntegrationsDTO';
import TeamAIProviderCatalog from '@modules/team/application/services/ai-integration/TeamAIProviderCatalog';
import TeamAIIntegration from '@modules/team/domain/entities/ai-integration/TeamAIIntegration';
import { injectable, inject } from 'tsyringe';

interface IdentifiableValue {
    _id?: string | { toString?: () => string };
};

const hasIdentifier = (value: unknown): value is IdentifiableValue => {
    return typeof value === 'object' && value !== null && '_id' in value;
};

const toStringId = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        return value;
    }

    if (hasIdentifier(value)) {
        const identifier = value._id;

        if (typeof identifier === 'string') {
            return identifier;
        }

        return identifier?.toString?.();
    }

    return undefined;
};

@injectable()
export default class TeamAIIntegrationSerializer {
    constructor(
        @inject(TEAM_TOKENS.TeamAIProviderCatalog)
        private readonly providerCatalog: TeamAIProviderCatalog
    ) {}

    toDTO(integration: TeamAIIntegration): TeamAIIntegrationItemDTO {
        const providerMetadata = this.providerCatalog.getProviderMetadata(integration.props.provider);

        return {
            _id: integration._id,
            teamId: String(integration.props.team),
            provider: integration.props.provider,
            providerName: providerMetadata.name,
            isEnabled: integration.props.isEnabled,
            defaultModel: integration.props.defaultModel,
            enabledModels: integration.props.enabledModels || [],
            metadata: integration.props.metadata,
            hasApiKey: true,
            createdBy: toStringId(integration.props.createdBy),
            createdAt: integration.props.createdAt,
            updatedAt: integration.props.updatedAt
        };
    }
};
