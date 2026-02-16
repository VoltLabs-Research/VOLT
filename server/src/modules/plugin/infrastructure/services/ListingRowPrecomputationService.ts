import { injectable, inject } from 'tsyringe';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { IListingRowRepository } from '@modules/plugin/domain/ports/IListingRowRepository';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { ISceneArtifactRepository } from '@modules/trajectory/domain/port/ISceneArtifactRepository';
import { resolveRow, Column } from '@modules/plugin/infrastructure/utilities/listing-resolver';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';
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

interface PrecomputeAnalysisParams {
    analysisId: string;
    teamId?: string;
}

interface ListingExposureDescriptor {
    exposureId: string;
    listingSlug: string;
    columns: Column[];
}

@injectable()
export class ListingRowPrecomputationService {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private pluginRepo: IPluginRepository,
        @inject(PLUGIN_TOKENS.ListingRowRepository)
        private listingRowRepo: IListingRowRepository,
        @inject(TRAJECTORY_TOKENS.SceneArtifactRepository)
        private sceneArtifactRepo: ISceneArtifactRepository,
        @inject(ANALYSIS_TOKENS.AnalysisRepository)
        private analysisRepo: IAnalysisRepository
    ) {}

    async precomputeForAnalysis(params: PrecomputeAnalysisParams): Promise<void> {
        const { analysisId, teamId: inputTeamId } = params;

        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) {
            throw new Error(`Analysis::NotFound:${analysisId}`);
        }

        const plugin = await this.pluginRepo.findById(analysis.props.plugin);
        if (!plugin) {
            throw new Error(`Plugin::NotFound:${analysis.props.plugin}`);
        }

        const workflow = plugin.props.workflow;
        if (!workflow?.props?.nodes?.length) {
            throw new Error(`Plugin::WorkflowMissing:${plugin.id}`);
        }

        const listingExposures = this.extractListingExposures(workflow);
        if (!listingExposures.length) {
            logger.info(`[ListingRowPrecomputation] No eligible listing exposures for plugin ${plugin.id}`);
            return;
        }

        const teamId = inputTeamId || analysis.props.team;
        const trajectoryId = analysis.props.trajectory;
        const createdAt = analysis.props.createdAt ?? new Date();
        const exposureFailures: string[] = [];
        let materializedRows = 0;

        for (const descriptor of listingExposures) {
            try {
                const artifacts = await this.sceneArtifactRepo.findAll({
                    filter: {
                        analysis: analysisId,
                        sourceType: 'plugin-exposure',
                        'params.exposureId': descriptor.exposureId
                    } as any,
                    page: 1,
                    limit: 100000,
                    sort: { timestep: 1, _id: 1 }
                });

                if (!artifacts.data.length) {
                    logger.warn(`[ListingRowPrecomputation] Skipping exposure without scene artifacts: listing=${descriptor.listingSlug}, exposureId=${descriptor.exposureId}, analysis=${analysisId}`);
                    continue;
                }

                for (const artifact of artifacts.data) {
                    const rawMetadata = artifact.props.metadata;
                    const listingMetadata = rawMetadata?.listingMetadata ?? rawMetadata;

                    if (!listingMetadata) {
                        throw new Error(`ListingPrecompute::MissingMetadata:analysis=${analysisId}:exposure=${descriptor.exposureId}:timestep=${artifact.props.timestep}`);
                    }

                    const row = resolveRow(descriptor.columns, listingMetadata, createdAt);
                    const unresolvedColumns = Object.entries(row)
                        .filter(([, value]) => value === null || value === undefined)
                        .map(([label]) => label);

                    if (unresolvedColumns.length > 0) {
                        throw new Error(
                            `ListingPrecompute::UnresolvedColumns:analysis=${analysisId}:exposure=${descriptor.exposureId}:timestep=${artifact.props.timestep}:columns=${unresolvedColumns.join(',')}`
                        );
                    }

                    const rowData = {
                        plugin: plugin.id,
                        team: teamId,
                        trajectory: trajectoryId,
                        trajectoryName: '',
                        analysis: analysisId,
                        listingSlug: descriptor.listingSlug,
                        exposureId: descriptor.exposureId,
                        timestep: artifact.props.timestep,
                        row
                    };

                    const existing = await this.listingRowRepo.findOne({
                        analysis: analysisId,
                        exposureId: descriptor.exposureId,
                        timestep: artifact.props.timestep
                    });

                    if (existing) {
                        await this.listingRowRepo.updateById(existing.id, rowData);
                    } else {
                        await this.listingRowRepo.create(rowData);
                    }

                    materializedRows += 1;
                }
            } catch (error: any) {
                const message = error?.message || String(error);
                logger.error(`[ListingRowPrecomputation] Exposure failed: listing=${descriptor.listingSlug}, exposureId=${descriptor.exposureId}, analysis=${analysisId}, error=${message}`);
                exposureFailures.push(message);
            }
        }

        if (materializedRows === 0) {
            throw new Error(`ListingPrecompute::NoRowsMaterialized:analysis=${analysisId}`);
        }

        if (exposureFailures.length > 0) {
            throw new Error(`ListingPrecompute::PartialFailure:analysis=${analysisId}:failures=${exposureFailures.join(' | ')}`);
        }
    }

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

        const listingExposures = this.extractListingExposures(workflow);
        const descriptor = listingExposures.find((item) => item.listingSlug === listingSlug);
        if (!descriptor) {
            logger.warn(`No listing descriptor found for listing: ${listingSlug}`);
            return;
        }

        // Find the primary exposure for this listing
        const primaryExposureId = descriptor.exposureId;
        if (!primaryExposureId) {
            logger.warn(`No primary exposure found for listing: ${listingSlug}`);
            return;
        }

        // Process each timestep
        for (const timestep of timesteps) {
            // Fetch exposure metadata
            const exposureArtifact = await this.sceneArtifactRepo.findOne({
                analysis: analysisId,
                sourceType: 'plugin-exposure',
                timestep,
                params: {
                    exposureId: primaryExposureId
                }
            } as any);

            if (!exposureArtifact || !exposureArtifact.props.metadata) {
                logger.warn(`No metadata found for exposure ${primaryExposureId}, timestep ${timestep}`);
                continue;
            }

            const rawMetadata = exposureArtifact.props.metadata;
            const listingMetadata = rawMetadata?.listingMetadata ?? rawMetadata;

            // Simple resolution using metadata._resolvedContext
            const row = resolveRow(descriptor.columns, listingMetadata, analysis.props.createdAt ?? new Date());
            
            logger.info(`[ListingRowPrecomputation] listingSlug=${listingSlug}, timestep=${timestep}`);
            logger.info(`[ListingRowPrecomputation] columns=${JSON.stringify(descriptor.columns.map(c => c.label))}`);
            logger.info(`[ListingRowPrecomputation] row=${JSON.stringify(row)}`);
            logger.info(`[ListingRowPrecomputation] metadata._resolvedContext=${JSON.stringify(listingMetadata?._resolvedContext)}`);

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

    private extractListingExposures(workflow: any): ListingExposureDescriptor[] {
        const nodes = workflow?.props?.nodes || [];
        const edges = workflow?.props?.edges || [];
        const descriptors: ListingExposureDescriptor[] = [];

        const exposures = nodes.filter((node: any) => node?.type === WorkflowNodeType.Exposure);

        for (const exposureNode of exposures) {
            const listingSlug = String(exposureNode?.data?.exposure?.name || '').trim();
            if (!listingSlug) continue;

            const columns = this.findListingColumnsForExposure(exposureNode.id, nodes, edges);
            if (!columns.length) continue;

            descriptors.push({
                exposureId: exposureNode.id,
                listingSlug,
                columns
            });
        }

        return descriptors;
    }

    private findListingColumnsForExposure(exposureId: string, nodes: any[], edges: any[]): Column[] {
        const visited = new Set<string>();
        const queue = [exposureId];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            visited.add(current);

            const outgoingEdges = edges.filter((edge: any) => edge.source === current);
            for (const edge of outgoingEdges) {
                const targetNode = nodes.find((node: any) => node.id === edge.target);
                if (!targetNode) continue;

                if (targetNode.type === WorkflowNodeType.Visualizers) {
                    const listing = targetNode?.data?.visualizers?.listing;
                    if (!listing || typeof listing !== 'object' || Object.keys(listing).length === 0) {
                        continue;
                    }

                    return Object.entries(listing).map(([path, label]) => ({
                        path,
                        label: String(label)
                    }));
                }

                queue.push(targetNode.id);
            }
        }

        return [];
    }
}
