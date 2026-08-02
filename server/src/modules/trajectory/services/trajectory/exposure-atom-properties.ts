import { ErrorCodes } from '@core/constants/error-codes';
import AnalysisEntity from '@modules/analysis/models/Analysis';
import PluginEntity from '@modules/plugin/models/Plugin';
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import { toAnalysisLike } from '@modules/analysis/services/AnalysisQueries';
import { toPluginLike } from '@modules/plugin/services/plugin/PluginQueries';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { WorkflowNodeType } from '@shared/contracts/types/Plugin';

import type { Analysis, PluginLike, WorkflowNodeLike } from '@shared/contracts/types';

/** Results only ever consumed by another exposure, never published per atom. */
const SHARED_ONLY_RESULTS_SUFFIX = 'neighbor_lattice.parquet';

type PerAtomPropertyType = 'number' | 'string';

interface PerAtomPropertySchema {
    name: string;
    type: PerAtomPropertyType;
}

export interface ExposureAtomConfig {
    exposureId: string;
    exposureName: string;
    perAtomProperties: string[];
    perAtomPropertyTypes: Record<string, PerAtomPropertyType>;
}

export interface AnalysisClusterContext {
    plugin: PluginLike;
    trajectoryId: string;
    ownerClusterId: string;
    teamClusterId?: string;
}

export interface AnalysisExposureContext extends AnalysisClusterContext {
    teamClusterId: string;
}

const requireAnalysisStorageClusterId = (analysis: Analysis): string => {
    const ownerClusterId = analysis.props.storageClusterId;
    if (!ownerClusterId) {
        throw ApplicationError.notFound(
            ErrorCodes.TEAM_CLUSTER_NOT_FOUND,
            `Analysis ${analysis._id} is missing its canonical storage cluster`
        );
    }

    return ownerClusterId;
};

/**
 * Where an analysis lives: the plugin that defines its exposures, the cluster
 * that holds its artifacts, and the cluster that computed them.
 */
export const resolveAnalysisClusterContext = async (analysisId: string): Promise<AnalysisClusterContext> => {
    const analysisEntity = await AnalysisEntity.findOneBy({ id: analysisId });
    if (!analysisEntity) throw ApplicationError.notFound(ErrorCodes.ANALYSIS_NOT_FOUND, 'Analysis not found');
    const analysis = toAnalysisLike(analysisEntity);

    const pluginEntity = await PluginEntity.findOneBy({ id: analysis.props.plugin });
    if (!pluginEntity) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NOT_FOUND, 'Plugin not found');

    return {
        plugin: toPluginLike(pluginEntity),
        trajectoryId: analysis.props.trajectory,
        ownerClusterId: requireAnalysisStorageClusterId(analysis),
        teamClusterId: analysis.props.computeClusterId
    };
};

/** Per-atom reads are served by the compute cluster, so it has to be known. */
export const requireAnalysisExposureContext = async (analysisId: string): Promise<AnalysisExposureContext> => {
    const context = await resolveAnalysisClusterContext(analysisId);
    const { teamClusterId } = context;
    if (!teamClusterId) {
        throw ApplicationError.notFound(ErrorCodes.TEAM_CLUSTER_NOT_FOUND, 'Cluster not found');
    }

    return {
        ...context,
        teamClusterId
    };
};

export const getExposureNodes = (plugin: PluginLike): WorkflowNodeLike[] => (
    plugin.props.workflow.props.nodes.filter((node) => (
        node.type === WorkflowNodeType.Exposure
        && !node.data?.exposure?.results?.endsWith(SHARED_ONLY_RESULTS_SUFFIX)
    ))
);

export const requireExposureNode = (plugin: PluginLike, exposureId: string): WorkflowNodeLike => {
    const exposureNode = getExposureNodes(plugin).find((node) => node.id === exposureId);
    if (!exposureNode) throw ApplicationError.notFound(ErrorCodes.PLUGIN_NODE_NOT_FOUND, 'Plugin node not found');

    return exposureNode;
};

/** Line exposures publish per-entity properties, not per-atom ones. */
export const getLineExposureIds = (plugin: PluginLike): Set<string> => {
    const ids = new Set<string>();
    for (const exposure of plugin.props.exposures ?? []) {
        if (exposure.export?.exporter === 'LineExporter' && exposure._id !== undefined) {
            ids.add(exposure._id);
        }
    }

    return ids;
};

const toPropertyDiscoveryBody = (
    analysisId: string,
    context: AnalysisExposureContext,
    exposureId: string,
    timestep?: string
): Record<string, unknown> => ({
    trajectoryId: context.trajectoryId,
    analysisId,
    exposureId,
    ...(timestep ? { timestep: Number(timestep) } : {}),
    ownerClusterId: context.ownerClusterId
});

const getPerAtomPropertySchemas = async (
    analysisId: string,
    context: AnalysisExposureContext,
    exposureId: string,
    timestep?: string
): Promise<PerAtomPropertySchema[]> => {
    try {
        const schemas = await teamClusterDaemonClient.command<PerAtomPropertySchema[]>(
            context.teamClusterId,
            ChannelCommands.TrajectoryPluginPropertySchema,
            toPropertyDiscoveryBody(analysisId, context, exposureId, timestep)
        );

        if (schemas.length > 0) {
            return schemas;
        }
    } catch {
        // Daemons that predate the schema command only expose property names.
    }

    const propertyNames = await teamClusterDaemonClient.command<string[]>(
        context.teamClusterId,
        ChannelCommands.TrajectoryPluginPropertyNames,
        toPropertyDiscoveryBody(analysisId, context, exposureId, timestep)
    );

    return propertyNames.map((name) => ({
        name,
        type: 'number'
    }));
};

/** What one exposure publishes per atom, named as the viewer labels it. */
export const buildExposureAtomConfig = async (
    analysisId: string,
    context: AnalysisExposureContext,
    exposureNode: WorkflowNodeLike,
    timestep?: string
): Promise<ExposureAtomConfig> => {
    const schemas = await getPerAtomPropertySchemas(analysisId, context, exposureNode.id, timestep);

    return {
        exposureId: exposureNode.id,
        exposureName: exposureNode.data?.exposure?.name?.trim() ?? '',
        perAtomProperties: schemas.map((schema) => schema.name),
        perAtomPropertyTypes: Object.fromEntries(schemas.map((schema) => [schema.name, schema.type]))
    };
};
