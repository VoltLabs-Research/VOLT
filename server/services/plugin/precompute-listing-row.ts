import { PluginListingRow, PluginExposureMeta, Trajectory, Analysis, Plugin } from '@/models';
import { buildNodeMap, buildParentMap, resolveRow } from '@/utilities/plugins/listing-resolver';
import { NodeType } from '@/types/models/modifier';
import type { IWorkflowNode } from '@/types/models/modifier';
import logger from '@/logger';

type Column = {
    path: string;
    label: string;
};

const findPrimaryExposureId = (nodes: IWorkflowNode[], listingSlug: string): string | null => {
    const node = nodes.find((x) => x.type === NodeType.EXPOSURE && x.data?.exposure?.name === listingSlug);
    return node?.id ?? null;
};

const extractColumnsFromVisualizer = (nodes: IWorkflowNode[], edges: any[], listingSlug: string): Column[] => {
    const exposureNode = nodes.find((node) => node.type === NodeType.EXPOSURE && node.data?.exposure?.name === listingSlug);
    if(!exposureNode) return [];

    const visited = new Set<string>();
    const q = [exposureNode.id];

    while(q.length){
        const id = q.shift()!;
        if(visited.has(id)) continue;
        visited.add(id);

        const outEdges = edges.filter((e: any) => e.source === id);
        for(const edge of outEdges){
            const target = nodes.find((node) => node.id === edge.target);
            if(!target) continue;

            if(target.type === NodeType.VISUALIZERS && target.data?.visualizers?.listing){
                const listingDef = target.data.visualizers.listing || {};
                return Object
                    .entries(listingDef)
                    .map(([path, label]) => ({ path, label: String(label) }));
            }

            q.push(edge.target);
        }
    }

    return [];
};

export const precomputeListingRowsForTimesteps = async (
    params: {
        pluginId: string,
        teamId: string,
        trajectoryId: string,
        analysisId: string,
        listingSlug: string,
        timesteps: number[]
    }
) => {
    const plugin = await Plugin.findById(params.pluginId).select('_id workflow').lean();
    if(!plugin) return;

    const { nodes, edges } = plugin.workflow;
    const columns = extractColumnsFromVisualizer(nodes, edges, params.listingSlug);
    if(!columns.length) return;

    const exposureIds = nodes.filter((node) => node.type === NodeType.EXPOSURE).map((node) => node.id);
    const primaryExposureId = findPrimaryExposureId(nodes, params.listingSlug);
    if(!primaryExposureId) return;

    const nodeMap = buildNodeMap(nodes);
    const parentMap = buildParentMap(edges);

    const trajectory = await Trajectory.findById(params.trajectoryId).select('_id name').lean();
    const analysis = await Analysis.findById(params.analysisId).select('_id config createdAt trajectory plugin').lean();
    if(!analysis) return;

    const metas = await PluginExposureMeta.find({
        plugin: params.pluginId,
        trajectory: params.trajectoryId,
        analysis: params.analysisId,
        timestep: { $in: params.timesteps },
        exposureId: { $in: exposureIds }
    })
        .select('timestep exposureId metadata')
        .lean();

    logger.debug(`[PrecomputeListingRow] Found ${metas.length} PluginExposureMeta for listing "${params.listingSlug}", primaryExposureId: ${primaryExposureId}, exposureIds: ${exposureIds.join(', ')}`);

    const byTimestep = new Map<number, Map<string, any>>();
    for(const meta of metas){
        const timestep = meta.timestep;
        let map = byTimestep.get(timestep);
        if(!map){
            map = new Map();
            byTimestep.set(timestep, map);
        }

        map.set(meta.exposureId, meta.metadata || {});
    }

    const ops: any[] = [];
    for(const timestep of params.timesteps){
        const perExposure = byTimestep.get(timestep);

        // Build exposureData even if no metas exist - use empty objects as fallback
        const exposureData = new Map<string, any>();
        for(const id of exposureIds){
            exposureData.set(id, perExposure?.get(id) ?? {});
        }

        const ctx = {
            nodeMap,
            parentMap,
            exposureData,
            trajectory,
            analysis,
            timestep
        };

        const row = resolveRow(columns, ctx);
        ops.push({
            updateOne: {
                filter: {
                    plugin: plugin._id,
                    listingSlug: params.listingSlug,
                    exposureId: primaryExposureId,
                    team: params.teamId,
                    trajectory: params.trajectoryId,
                    analysis: params.analysisId,
                    timestep
                },
                update: {
                    $set: {
                        row,
                        exposureId: primaryExposureId,
                        trajectoryName: trajectory?.name ?? undefined
                    }
                },
                upsert: true
            }
        });
    }

    if(ops.length){
        await PluginListingRow.bulkWrite(ops, { ordered: false });
    }
};