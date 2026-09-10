import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import teamService from '@modules/team/services/TeamService';
import teamMemberService from '@modules/team/services/TeamMemberService';
import teamAIIntegrationService from '@modules/team/services/TeamAIIntegrationService';
import type { GetTeamContextInput } from '@volt/contracts/modules/team/ai-tools';

export default class TeamAIToolController extends AIToolController {
    @AITool({
        name: 'get_team_context',
        description: 'Get a snapshot of the current team: team info, its members with their roles and online presence, and the configured AI provider integrations plus which models are available. Use this to understand who is on the team and what AI capabilities are set up.',
        parameters: typia.llm.parameters<GetTeamContextInput>(),
        validate: typia.createValidate<GetTeamContextInput>()
    })
    async getTeamContext(input: GetTeamContextInput & AIToolScope) {
        const team = await teamService.getById(input.teamId);
        const { data: members } = await teamMemberService.listByTeamId(input.teamId);
        const { integrations, providers } = await teamAIIntegrationService.listByTeamId(input.teamId);
        const { models } = await teamAIIntegrationService.listModels(input.teamId);

        const onlineCount = members.filter((member) => (
            typeof member.user !== 'string' && member.user.isOnline
        )).length;

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
