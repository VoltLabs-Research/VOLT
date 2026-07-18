import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    destination: z.string().describe(
        'Logical destination key. One of: dashboard_home, trajectories_list, trajectory_artifacts, '
        + 'trajectory_atoms, simulation_cells, analysis_configs, analysis_sub_listings, plugins_list, '
        + 'plugin_builder, plugin_exposure_listing, trajectory_plugin_exposure_listing, clusters_list, '
        + 'cluster_monitoring, containers_list, container_create, container_details, messages, '
        + 'ai_conversation, latex_list, latex_workspace, notebooks, whiteboards, whiteboard_editor, '
        + 'my_team, manage_roles, secret_keys, secret_key_metrics, settings_general, '
        + 'settings_authentication, settings_theme, settings_integrations, settings_sessions.'
    ),
    params: z.record(z.string(), z.string()).optional().describe(
        'Entity ids the destination requires, e.g. { trajectoryId, analysisId, pluginId, exposureId, '
        + 'clusterId, containerId, documentId, whiteboardId, secretKeyId, conversationId, chatId }. '
        + 'Resolve real ids with global_search or list_* tools first — never invent them.'
    ),
    query: z.record(z.string(), z.string()).optional().describe('Optional query string params, e.g. { tab: "terminal" }.')
});

type NavigateToParams = z.infer<typeof parameters>;

export class NavigateToAITool extends AITool<NavigateToParams> {
    readonly name = 'navigate_to';
    readonly description = 'Navigate the user to an in-app page by logical destination key with resolved entity ids. '
        + 'Use this to take the user somewhere after answering (e.g. to a trajectory, an analysis, a cluster). '
        + 'Only known destinations are allowed; resolve ids with global_search / list_* first.';
    readonly parameters = parameters;
    protected readonly clientExecuted = true;
}
