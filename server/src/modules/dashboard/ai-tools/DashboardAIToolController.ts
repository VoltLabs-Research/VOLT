import typia from 'typia';
import AIToolController from '@shared/ai/AIToolController';
import { AIToolProvider } from '@shared/ai/provider-registry';
import { AITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import DashboardService from '@modules/dashboard/services/DashboardService';
import teamMetricsQueryService from '@modules/trajectory/services/trajectory/TeamMetricsQueryService';
import type {
    GetDashboardMetricsInput,
    GlobalSearchInput
} from '@volt/contracts/modules/dashboard/ai-tools';

@AIToolProvider()
export default class DashboardAIToolController extends AIToolController {
    #service = new DashboardService();

    @AITool({
        name: 'get_dashboard_metrics',
        description: 'Get the dashboard overview metrics for the current team: total counts, last-month counts, '
            + 'and weekly time-series for the main resources (trajectories, analyses, etc.).',
        parameters: typia.llm.parameters<GetDashboardMetricsInput>(),
        validate: typia.createValidate<GetDashboardMetricsInput>()
    })
    async getDashboardMetrics(input: GetDashboardMetricsInput & AIToolScope) {
        const metrics = await teamMetricsQueryService.getTeamMetrics(input.teamId);

        const totalCount = Object.values(metrics.totals).reduce((sum, value) => sum + value, 0);

        return {
            summary: `Team dashboard metrics: ${totalCount} total resource(s) across ${Object.keys(metrics.totals).length} categor(ies).`,
            data: metrics
        };
    }

    @AITool({
        name: 'global_search',
        description: 'Search across the current team for trajectories, analyses, containers, plugins, teams and chats by name/content. '
            + 'Returns matches grouped by type, each with a deepLink the UI can navigate to.',
        parameters: typia.llm.parameters<GlobalSearchInput>(),
        validate: typia.createValidate<GlobalSearchInput>()
    })
    async globalSearch(input: GlobalSearchInput & AIToolScope) {
        const { analyses, containers, trajectories, teams, plugins, chats } = await this.#service.getGlobalSearch(input);

        const trajectoryItems = trajectories.map((trajectory) => ({
            ...trajectory,
            id: trajectory._id,
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
            ...team.toJSON(),
            id: team.id,
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
