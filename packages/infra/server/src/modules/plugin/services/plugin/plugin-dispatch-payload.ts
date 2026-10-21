import type { Plugin } from '@modules/plugin/contracts/plugin';
import pluginBinaryOwnerResolver from '@modules/plugin/services/plugin/PluginBinaryOwnerResolver';
import pluginBinarySyncService from '@modules/plugin/services/plugin/PluginBinarySyncService';
import pluginDispatchEncoder from '@modules/plugin/services/plugin/PluginDispatchEncoder';
import type { Analysis } from '@shared/contracts/types/AnalysisProps';
import type {
    TrajectoryFrame,
    DaemonAnalysisDocument,
    AnalysisStartTransportRequest,
    PluginReferenceExecutionRequest
} from '@volt/contracts/modules/analysis/daemon';

export interface RoutePluginExecutionInput {
    teamClusterId: string;
    analysis: Analysis;
    analysisId: string;
    pluginDisplayName: string;
    trajectoryId: string;
    trajectoryName: string;
    trajectoryFrames: TrajectoryFrame[];
    teamId: string;
    plugin: Plugin;
    pluginDependencies: Plugin[];
    pluginReferenceExecutions: PluginReferenceExecutionRequest[];
    config: Record<string, unknown>;
    selectedTimesteps?: number[];
    timestep?: number;
}

const serializeAnalysis = (analysis: Analysis): DaemonAnalysisDocument => {
    return {
        _id: analysis._id,
        plugin: analysis.props.plugin,
        pluginDisplayName: analysis.props.pluginDisplayName,
        computeClusterId: analysis.props.computeClusterId,
        storageClusterId: analysis.props.storageClusterId,
        config: analysis.props.config,
        trajectory: analysis.props.trajectory,
        createdBy: analysis.props.createdBy,
        totalFrames: analysis.props.totalFrames,
        startedAt: analysis.props.startedAt,
        finishedAt: analysis.props.finishedAt,
        team: analysis.props.team,
        status: analysis.props.status,
        createdAt: analysis.props.createdAt,
        updatedAt: analysis.props.updatedAt
    };
};

const dedupeBy = <T>(items: T[], keyOf: (item: T) => string): T[] => {
    const deduped = new Map<string, T>();

    for (const item of items) {
        const key = keyOf(item);
        if (!deduped.has(key)) {
            deduped.set(key, item);
        }
    }

    return Array.from(deduped.values());
};

const pluginReferenceExecutionKey = (request: PluginReferenceExecutionRequest): string => {
    return JSON.stringify({
        referencePath: request.referencePath,
        pluginId: request.pluginId,
        config: request.config
    });
};

export const buildPluginDispatch = async (
    input: RoutePluginExecutionInput
): Promise<{ dispatchPayload: AnalysisStartTransportRequest; syncTasks: Promise<void>[] }> => {
    const uniqueDependencyPlugins = dedupeBy(input.pluginDependencies, (plugin) => plugin.id);
    const pluginsToSync = dedupeBy([
        input.plugin,
        ...uniqueDependencyPlugins
    ], (plugin) => plugin.id);

    const pluginOwners = await Promise.all(pluginsToSync.map(async (plugin) => ({
        plugin,
        ownerClusterId: await pluginBinaryOwnerResolver.resolveOwnerClusterId(plugin)
    })));
    const ownerClusterIdsByPluginId = new Map(pluginOwners.map(
        ({ plugin, ownerClusterId }) => [plugin.id, ownerClusterId] as const
    ));

    const [
        trajectoryFramesCompressed,
        workflowCompressed,
        nestedPluginsCompressed,
        pluginReferenceExecutionsCompressed
    ] = await Promise.all([
        pluginDispatchEncoder.encode(input.trajectoryFrames),
        pluginDispatchEncoder.encodeWorkflow(input.plugin, ownerClusterIdsByPluginId.get(input.plugin.id) ?? ''),
        pluginDispatchEncoder.encodeNestedPlugins(input.plugin.id, uniqueDependencyPlugins, ownerClusterIdsByPluginId),
        pluginDispatchEncoder.encode(dedupeBy(input.pluginReferenceExecutions, pluginReferenceExecutionKey))
    ]);

    const syncTasks = pluginOwners.map(({ plugin, ownerClusterId }) => pluginBinarySyncService.syncIfNeeded(
        input.teamClusterId,
        plugin,
        ownerClusterId
    ));

    return {
        dispatchPayload: {
            analysis: serializeAnalysis(input.analysis),
            analysisId: input.analysisId,
            pluginId: input.plugin.id,
            pluginDisplayName: input.pluginDisplayName,
            teamId: input.teamId,
            teamClusterId: input.teamClusterId,
            trajectoryId: input.trajectoryId,
            trajectoryFramesCompressed,
            workflowCompressed,
            nestedPluginsCompressed,
            pluginReferenceExecutionsCompressed,
            config: input.config,
            selectedTimesteps: input.selectedTimesteps,
            timestep: input.timestep
        },
        syncTasks
    };
};
