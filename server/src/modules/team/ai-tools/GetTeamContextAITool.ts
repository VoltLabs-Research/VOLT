import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TeamService from '@modules/team/services/TeamService';
import TeamMemberService from '@modules/team/services/TeamMemberService';
import TeamAIIntegrationService from '@modules/team/services/TeamAIIntegrationService';
import { isPopulatedTeamMemberUser } from '@modules/team/models/team-member/TeamMemberModel';
import type { TeamMemberProps } from '@modules/team/models/team-member/TeamMemberModel';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetTeamContextAITool extends AITool {
    readonly name = 'get_team_context';
    readonly description = 'Get a snapshot of the current team: team info, its members with their roles and online presence, and the configured AI provider integrations plus which models are available. Use this to understand who is on the team and what AI capabilities are set up.';
    readonly parameters = z.object({});

    #team = new TeamService();
    #members = new TeamMemberService();
    #aiIntegrations = new TeamAIIntegrationService();

    async execute(_params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const team = await this.#team.getById(scope.teamId);
        const membersOutput = await this.#members.listByTeamId(scope.teamId);
        const integrations = await this.#aiIntegrations.listByTeamId(scope.teamId);
        const models = await this.#aiIntegrations.listModels(scope.teamId);

        const members = membersOutput.data;
        const onlineCount = members.filter((member) => {
            const user = (member as { user?: TeamMemberProps['user'] }).user;
            return user !== undefined && isPopulatedTeamMemberUser(user) && user.isOnline === true;
        }).length;

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
