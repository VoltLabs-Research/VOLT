import 'reflect-metadata';
import '@core/bootstrap/register-deps';
import BaseWorker from '@shared/infrastructure/workers/BaseWorker';
import logger from '@shared/infrastructure/logger';
import TrajectoryDumpStorageService from '@modules/trajectory/infrastructure/services/TrajectoryDumpStorageService';
import { container } from 'tsyringe';
import { performance } from 'node:perf_hooks';
import Job from '@modules/jobs/domain/entities/Job';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { IPluginWorkflowEngine } from '@modules/plugin/domain/ports/IPluginWorkflowEngine';
import { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import { ANALYSIS_TOKENS } from '@modules/analysis/infrastructure/di/AnalysisTokens';
import { IAnalysisRepository } from '@modules/analysis/domain/port/IAnalysisRepository';
import { initializeNodeHandlers } from '@modules/plugin/infrastructure/di/container';
import { ListingRowPrecomputationService } from '@modules/plugin/infrastructure/services/ListingRowPrecomputationService';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/workflow/WorkflowNode';

export interface AnalysisJobMetadata {
    trajectoryId: string;
    analysisId: string;
    config: Record<string, any>;
    inputFile: string;
    timestep: number;
    trajectoryName: string;
    modifierId: string;
    plugin: string;
    name: string;
    totalItems: number;
    itemIndex: number;
    forEachItem: any;
    forEachIndex: number;
}

export default class AnalysisWorker extends BaseWorker<Job> {
    private dumpStorage!: TrajectoryDumpStorageService;
    private workflowEngine!: IPluginWorkflowEngine;
    private pluginRepository!: IPluginRepository;
    private analysisRepository!: IAnalysisRepository;
    private precomputationService!: ListingRowPrecomputationService;

    protected async setup(): Promise<void> {
        await this.connectDB();
        
        // Initialize node handlers for workflow execution
        initializeNodeHandlers();
        
        this.dumpStorage = container.resolve(TrajectoryDumpStorageService);
        this.workflowEngine = container.resolve<IPluginWorkflowEngine>(PLUGIN_TOKENS.PluginWorkflowEngine);
        this.pluginRepository = container.resolve<IPluginRepository>(PLUGIN_TOKENS.PluginRepository);
        this.analysisRepository = container.resolve<IAnalysisRepository>(ANALYSIS_TOKENS.AnalysisRepository);
        this.precomputationService = container.resolve<ListingRowPrecomputationService>(PLUGIN_TOKENS.ListingRowPrecomputationService);
    }

    protected async perform(job: Job): Promise<void> {
        const metadata = job.props.metadata as AnalysisJobMetadata;
        const { 
            trajectoryId, 
            analysisId, 
            config, 
            plugin: pluginSlug,
            forEachItem,
            forEachIndex,
            totalItems
        } = metadata;
        const { jobId } = job.props;
        const timestep = this.resolveJobTimestep(metadata);

        const start = performance.now();
        logger.info(`@analysis-worker #${process.pid}] start job ${jobId} | frame ${timestep} (${forEachIndex + 1}/${totalItems})`);

        try {
            // Check if dump exists by trying to get it
            const dumpPath = await this.dumpStorage.getDump(trajectoryId, String(timestep));
            if (!dumpPath) {
                logger.info(`@analysis-worker #${process.pid}] Frame ${timestep} not found in storage. Requesting wait status.`);
                this.sendMessage({
                    status: 'waiting_for_upload',
                    jobId,
                    trajectoryId,
                    timestep
                });
                return;
            }

            // Find the plugin
            const plugin = await this.pluginRepository.findOne({ slug: pluginSlug });
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginSlug}`);
            }

            // Execute the workflow for this specific item
            await this.workflowEngine.executeWorkflowJob({
                plugin,
                trajectoryId,
                analysisId,
                userConfig: config || {},
                teamId: job.props.teamId,
                currentIterationItem: forEachItem,
                currentIterationIndex: forEachIndex
            });

            // Update progress
            await this.updateProgress(analysisId, totalItems);

            // Precompute listing rows after workflow execution
            await this.handleListingPrecomputation(job, metadata, plugin, timestep);

            const totalTime = (performance.now() - start).toFixed(2);
            logger.info(`@analysis-worker #${process.pid}] job ${jobId} success | duration: ${totalTime}ms`);

            this.sendMessage({
                status: 'completed',
                jobId,
                timestep,
                duration: totalTime
            });
        } catch (error: any) {
            logger.error(`@analysis-worker #${process.pid}] error processing job ${jobId}: ${error.message}\nStack: ${error.stack}`);
            
            // Mark analysis as failed
            await this.analysisRepository.updateById(analysisId, {
                status: 'failed',
                finishedAt: new Date()
            }).catch(() => {});

            this.sendMessage({
                status: 'failed',
                jobId,
                timestep,
                error: error.message
            });
        }
    }

    private resolveJobTimestep(metadata: AnalysisJobMetadata): number {
        const direct = metadata.timestep;
        if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

        const item = metadata.forEachItem;
        const fromItem = 
            (typeof item?.timestep === 'number' && Number.isFinite(item.timestep) && item.timestep) ||
            (typeof item?.frame === 'number' && Number.isFinite(item.frame) && item.frame);

        if (typeof fromItem === 'number') return fromItem;

        const idx = metadata.forEachIndex;
        if (typeof idx === 'number' && Number.isFinite(idx)) return idx;

        return 0;
    }

    private async updateProgress(analysisId: string, totalItems: number): Promise<void> {
        try {
            const analysis = await this.analysisRepository.findById(analysisId);
            if (!analysis) return;

            const completedFrames = (analysis.props.completedFrames || 0) + 1;
            
            const updateData: any = {
                completedFrames,
                clusterId: process.env.CLUSTER_ID || 'default'
            };

            if (completedFrames >= totalItems) {
                updateData.status = 'completed';
                updateData.finishedAt = new Date();
            }

            await this.analysisRepository.updateById(analysisId, updateData);
        } catch (error: any) {
            logger.warn(`@analysis-worker #${process.pid}] Failed to update progress: ${error.message}`);
        }
    }

    private async handleListingPrecomputation(job: Job, metadata: AnalysisJobMetadata, plugin: any, timestep: number): Promise<void> {
        try {
            const teamId = job.props.teamId;
            if (!teamId) {
                logger.warn(`@analysis-worker #${process.pid}] Missing teamId in job, skipping listing row precomputation`);
                return;
            }

            const listingSlugs = this.extractListingSlugs(plugin);
            if (listingSlugs.length > 0) {
                logger.info(`@analysis-worker #${process.pid}] Precomputing ${listingSlugs.length} listing rows`);
                
                await Promise.all(
                    listingSlugs.map((listingSlug) =>
                        this.precomputationService.precomputeListingRowsForTimesteps({
                            pluginId: plugin.id,
                            teamId,
                            trajectoryId: metadata.trajectoryId,
                            analysisId: metadata.analysisId,
                            listingSlug,
                            timesteps: [timestep]
                        })
                    )
                );
            }
        } catch (error: any) {
            logger.warn(`@analysis-worker #${process.pid}] Precompute listing rows failed: ${error?.message || error}`);
        }
    }

    private extractListingSlugs(plugin: any): string[] {
        const workflow = plugin?.props?.workflow;
        if (!workflow?.props?.nodes) return [];

        const result = new Set<string>();
        const exposures = workflow.props.nodes.filter((n: any) => n.type === WorkflowNodeType.Exposure);

        for (const exp of exposures) {
            const listingSlug = exp?.data?.exposure?.name;
            if (!listingSlug) continue;

            // Find descendant visualizer node
            const edges = workflow.props.edges || [];
            const visited = new Set<string>();
            const queue = [exp.id];

            while (queue.length > 0) {
                const id = queue.shift()!;
                if (visited.has(id)) continue;
                visited.add(id);

                const node = workflow.props.nodes.find((n: any) => n.id === id);
                if (node?.type === WorkflowNodeType.Visualizers) {
                    const listing = node?.data?.visualizers?.listing;
                    if (listing && typeof listing === 'object' && Object.keys(listing).length > 0) {
                        result.add(listingSlug);
                        break;
                    }
                }

                const outEdges = edges.filter((e: any) => e.source === id);
                for (const edge of outEdges) {
                    queue.push(edge.target);
                }
            }
        }

        return Array.from(result);
    }
}

BaseWorker.start(AnalysisWorker);
