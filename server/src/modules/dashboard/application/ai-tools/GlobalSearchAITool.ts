import GetGlobalSearchUseCase from '@modules/dashboard/application/use-cases/GetGlobalSearchUseCase';
import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GlobalSearchAITool extends AITool {
    readonly name = 'global_search';
    readonly description =
        'Search across the current team for trajectories, analyses, containers, plugins, teams and chats by name/content. '
        + 'Returns matches grouped by type, each with a deepLink the UI can navigate to.';
    readonly parameters = z.object({
        query: z.string().optional().describe('Free-text search term (at least 2 characters to match anything).'),
        limit: z.number().optional().describe('Max results per entity type (1-10, default 5).')
    });

    constructor(
        protected readonly useCase: GetGlobalSearchUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.useCase.execute({
            teamId: scope.teamId,
            userId: scope.userId,
            query: params.query,
            limit: params.limit
        });

        const { analyses, containers, trajectories, teams, plugins, chats } = value;

        const trajectoryItems = trajectories.map((trajectory) => ({
            ...trajectory,
            id: trajectory._id,
            name: trajectory.name,
            deepLink: `/canvas/${trajectory._id}`
        }));

        const analysisItems = analyses.map((analysis) => {
            const trajectoryId = typeof analysis.trajectory === 'string'
                ? analysis.trajectory
                : analysis.trajectory?._id;
            return {
                ...analysis,
                id: analysis._id,
                name: analysis.pluginDisplayName,
                deepLink: `/canvas/${trajectoryId}?analysis=${analysis._id}`
            };
        });

        const containerItems = containers.map((container) => ({
            ...container,
            id: container._id,
            name: container.name,
            deepLink: `/dashboard/containers/${container._id}`
        }));

        const pluginItems = plugins.map((plugin) => {
            const exposureId = plugin.listingExposures?.exposures?.[0]?.exposureId
                ?? plugin.exposures?.find((exposure) => exposure.hasListing)?._id
                ?? plugin.exposures?.[0]?._id;
            const deepLink = exposureId
                ? `/dashboard/plugins/${plugin._id}/exposure/${exposureId}/listing`
                : '/dashboard/plugins/list';
            return {
                ...plugin,
                id: plugin._id,
                name: plugin.modifier?.name,
                deepLink
            };
        });

        const teamItems = teams.map((team) => ({
            ...team,
            id: team._id,
            name: team.name,
            deepLink: '/dashboard/my-team'
        }));

        const chatItems = chats.map((chat) => ({
            ...chat,
            id: chat._id,
            name: chat.isGroup ? chat.groupName : undefined,
            deepLink: `/dashboard/messages/${chat._id}`
        }));

        const total = trajectoryItems.length
            + analysisItems.length
            + containerItems.length
            + pluginItems.length
            + teamItems.length
            + chatItems.length;

        return {
            summary: `Found ${total} result(s) across trajectories, analyses, containers, plugins, teams and chats.`,
            data: {
                trajectories: trajectoryItems,
                analyses: analysisItems,
                containers: containerItems,
                plugins: pluginItems,
                teams: teamItems,
                chats: chatItems
            }
        };
    }
}
