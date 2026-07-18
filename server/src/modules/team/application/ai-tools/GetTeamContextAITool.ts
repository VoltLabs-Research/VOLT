import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetTeamByIdUseCase from '@modules/team/application/use-cases/team/GetTeamByIdUseCase';
import ListTeamMembersByTeamIdUseCase from '@modules/team/application/use-cases/team-member/ListTeamMembersByTeamIdUseCase';
import { isPopulatedTeamMemberUser } from '@modules/team/domain/entities/team-member/TeamMember';
import GetTeamAIIntegrationsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationsUseCase';
import GetTeamAIIntegrationModelsUseCase from '@modules/team/application/use-cases/ai-integration/GetTeamAIIntegrationModelsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetTeamContextAITool extends AITool {
    readonly name = 'get_team_context';
    readonly description = 'Get a snapshot of the current team: team info, its members with their roles and online presence, and the configured AI provider integrations plus which models are available. Use this to understand who is on the team and what AI capabilities are set up.';
    readonly parameters = z.object({});

    constructor(
        protected readonly getTeamByIdUseCase: GetTeamByIdUseCase,
        protected readonly listTeamMembersUseCase: ListTeamMembersByTeamIdUseCase,
        protected readonly getAIIntegrationsUseCase: GetTeamAIIntegrationsUseCase,
        protected readonly getAIIntegrationModelsUseCase: GetTeamAIIntegrationModelsUseCase
    ) {
        super();
    }

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const team = await this.getTeamByIdUseCase.execute({ teamId: scope.teamId });
        const membersOutput = await this.listTeamMembersUseCase.execute({ teamId: scope.teamId });
        const integrations = await this.getAIIntegrationsUseCase.execute({ teamId: scope.teamId });
        const models = await this.getAIIntegrationModelsUseCase.execute({ teamId: scope.teamId });

        const members = membersOutput.data;
        const onlineCount = members.filter((member) =>
            isPopulatedTeamMemberUser(member.user) && member.user.isOnline === true
        ).length;

        const enabledIntegrations = integrations.integrations.filter((integration) => integration.isEnabled);

        return {
            summary: `Team "${team.name}" has ${members.length} members (${onlineCount} online), ${enabledIntegrations.length} enabled AI integration(s), and ${models.models.length} available model(s).`,
            data: {
                team,
                members,
                aiIntegrations: integrations.integrations,
                aiProviders: integrations.providers,
                aiModels: models.models
            }
        };
    }
}
