import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import { IExposureMetaRepository } from '@modules/plugin/domain/ports/IExposureMetaRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { resolveRow, Column } from '@modules/plugin/infrastructure/utilities/listing-resolver';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import logger from '@shared/infrastructure/logger';

interface PrecomputeParams {
    pluginId: string;
    teamId: string;
    trajectoryId: string;
    trajectoryName: string;
    analysisId: string;
    listingSlug: string;
    timesteps: number[];
}

@injectable()
export class ListingRowPrecomputationService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private listingRowRepo: IListingRowRepository,
        @inject(PLUGIN_TOKENS.ExposureMetaRepository)
        private exposureMetaRepo: IExposureMetaRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ) {}

    async precomputeListingRowsForTimesteps(params: PrecomputeParams): Promise<void> {
        const { pluginId, teamId, trajectoryId, trajectoryName, analysisId, listingSlug, timesteps } = params;

        // Fetch plugin to get workflow
        const plugin = await this.pluginRepo.findById(pluginId);
        if (!plugin) {
            logger.warn(`Plugin not found: ${pluginId}`);
            return;
        }

        // Fetch analysis for createdAt
        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) {
            logger.warn(`Analysis not found: ${analysisId}`);
            return;
        }

        const workflow = plugin.props.workflow;
        if (!workflow?.props.nodes) {
            logger.warn(`Plugin ${pluginId} has no workflow`);
            return;
        }

        // Find columns for this listing
        const columns = this.extractColumnsFromListing(workflow, listingSlug);
        if (!columns.length) {
            logger.warn(`No columns found for listing: ${listingSlug}`);
            return;
        }

        // Find the primary exposure for this listing
        const primaryExposureId = this.findPrimaryExposureId(workflow, listingSlug);
        if (!primaryExposureId) {
            logger.warn(`No primary exposure found for listing: ${listingSlug}`);
            return;
        }

        // Process each timestep
        for (const timestep of timesteps) {
            // Fetch exposure metadata
            const exposureMeta = await this.exposureMetaRepo.findOne({
                analysis: analysisId,
                exposureId: primaryExposureId,
                timestep
            });

            if (!exposureMeta || !exposureMeta.props.metadata) {
                logger.warn(`No metadata found for exposure ${primaryExposureId}, timestep ${timestep}`);
                continue;
            }

            // Simple resolution using metadata._resolvedContext
            const row = resolveRow(columns, exposureMeta.props.metadata, analysis.props.createdAt ?? new Date());
            
            logger.info(`[ListingRowPrecomputation] listingSlug=${listingSlug}, timestep=${timestep}`);
            logger.info(`[ListingRowPrecomputation] columns=${JSON.stringify(columns.map(c => c.label))}`);
            logger.info(`[ListingRowPrecomputation] row=${JSON.stringify(row)}`);
            logger.info(`[ListingRowPrecomputation] metadata._resolvedContext=${JSON.stringify(exposureMeta.props.metadata._resolvedContext)}`);

            // Upsert listing row
            const existing = await this.listingRowRepo.findOne({
                analysis: analysisId,
                exposureId: primaryExposureId,
                timestep
            });

            const rowData = {
                plugin: pluginId,
                trajectory: trajectoryId,
                trajectoryName,
                analysis: analysisId,
                exposureId: primaryExposureId,
                listingSlug,
                timestep,
                team: teamId,
                row 
            };

            if (existing) {
                await this.listingRowRepo.updateById(existing.id, rowData);
            } else {
                await this.listingRowRepo.create(rowData);
            }
        }
    }

    private extractColumnsFromListing(workflow: any, listingSlug: string): Column[] {
        const nodes = workflow.props.nodes;
        const edges = workflow.props.edges;

        // Find exposure node for this listing
        const exposureNode = nodes.find((node: any) => 
            node.type === 'exposure' && node.data?.exposure?.name === listingSlug
        );
        if (!exposureNode) return [];

        // BFS from exposure forward to find connected visualizer
        const visited = new Set<string>();
        const queue = [exposureNode.id];

        while (queue.length) {
            const id = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);

            // Find outgoing edges (edges where source is current node)
            const outEdges = edges.filter((e: any) => e.source === id);
            for (const edge of outEdges) {
                const target = nodes.find((node: any) => node.id === edge.target);
                if (!target) continue;

                // Check if target is a visualizer with listing
                if (target.type === 'visualizers' && target.data?.visualizers?.listing) {
                    const listingDef = target.data.visualizers.listing || {};
                    return Object.entries(listingDef).map(([path, label]) => ({
                        path,
                        label: String(label)
                    }));
                }

                queue.push(edge.target);
            }
        }

        return [];
    }

    private findPrimaryExposureId(workflow: any, listingSlug: string): string | null {
        for (const node of workflow.props.nodes) {
            if (node.type === 'exposure' && node.data?.exposure?.name === listingSlug) {
                return node.id;
            }
        }
        return null;
    }
}
