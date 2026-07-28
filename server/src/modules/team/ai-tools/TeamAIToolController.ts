import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import TeamService from '@modules/team/services/TeamService';
import TeamMemberService from '@modules/team/services/TeamMemberService';
import TeamAIIntegrationService from '@modules/team/services/TeamAIIntegrationService';
import { isPopulatedTeamMemberUser } from '@modules/team/models/team-member/TeamMemberModel';
import type { TeamMemberProps } from '@modules/team/models/team-member/TeamMemberModel';
import {
    getTeamContextSchema,
    type GetTeamContextInput
} from '@volt/contracts/modules/team/ai-tools';

export default class TeamAIToolController extends AIToolController {
    #team = new TeamService();
    #members = new TeamMemberService();
    #aiIntegrations = new TeamAIIntegrationService();

    @AITool({
        name: 'get_team_context',
        description: 'Get a snapshot of the current team: team info, its members with their roles and online presence, and the configured AI provider integrations plus which models are available. Use this to understand who is on the team and what AI capabilities are set up.',
        parameters: getTeamContextSchema
    })
    async getTeamContext(input: GetTeamContextInput & AIToolScope) {
        const team = await this.#team.getById(input.teamId);
        const { data: members } = await this.#members.listByTeamId(input.teamId);
        const { integrations, providers } = await this.#aiIntegrations.listByTeamId(input.teamId);
        const { models } = await this.#aiIntegrations.listModels(input.teamId);

        const onlineCount = members.filter((member) => {
            const user = (member as { user?: TeamMemberProps['user'] }).user;
            return user !== undefined && isPopulatedTeamMemberUser(user) && user.isOnline === true;
        }).length;

        const enabledIntegrations = integrations.filter((integration) => integration.isEnabled);

        return {
            summary: `Team "${team.name}" has ${members.length} members (${onlineCount} online), ${enabledIntegrations.length} enabled AI integration(s), and ${models.length} available model(s).`,
            data: {
                team,
                members,
                aiIntegrations: integrations,
                aiProviders: providers,
                aiModels: models
            }
        };
    }
}
