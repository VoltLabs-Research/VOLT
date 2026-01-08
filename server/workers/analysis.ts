
import { BaseWorker } from './base-worker';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import { Analysis, Plugin } from '@/models';
import PluginWorkflowEngine from '@/services/plugin/workflow-engine';
import DumpStorage from '@/services/trajectory/dump-storage';
import { precomputeListingRowsForTimesteps } from '@/services/plugin/precompute-listing-row';
import { findDescendantByType } from '@/utilities/plugins/workflow-utils';
import { NodeType } from '@/types/models/plugin';
import logger from '@/logger';
import '@/services/nodes/handlers';

class AnalysisWorker extends BaseWorker<AnalysisJob> {
    protected async setup(): Promise<void> {
        await this.connectDB();
    }

    protected async perform(job: AnalysisJob): Promise<void> {
        if (!job) throw new Error('No job data received.');

        try {
            const frameTimestep = this.resolveJobTimestep(job);
            const exists = await DumpStorage.exists(job.trajectoryId, frameTimestep);

            if (!exists) {
                logger.info(`[Worker #${process.pid}] Frame ${frameTimestep} not found in MinIO. Requesting wait status.`);
                this.sendMessage({
                    status: 'waiting_for_upload',
                    jobId: job.jobId,
                    trajectoryId: job.trajectoryId,
                    timestep: frameTimestep
                });
                return;
            }

            logger.info(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);

            const plugin = await Plugin.findOne({ slug: job.plugin }).lean();
            if (!plugin) throw new Error(`Plugin not found: ${job.plugin}`);

            const engine = new PluginWorkflowEngine();
            await engine.execute(
                plugin as any,
                job.trajectoryId,
                job.analysisId,
                job.config || {},
                (job as any).teamId,
                (job as any).forEachItem,
                (job as any).forEachIndex,
            );

            await this.updateProgress(job.analysisId);
            await this.handleListingPrecomputation(job, plugin, frameTimestep);

            this.sendMessage({
                status: 'completed',
                jobId: job.jobId,
                timestep: job.timestep,
                result: null
            });

            logger.info(`[Worker #${process.pid}] Finished job ${job.jobId} successfully.`);

        } catch (err: any) {
            logger.error(`[Worker #${process.pid}] Error processing job ${job.jobId}: ${err.message}`);

            await Analysis.updateOne(
                { _id: job.analysisId },
                { status: 'failed', finishedAt: new Date() }
            ).catch(() => { });

            this.sendMessage({
                status: 'failed',
                timestep: job.timestep,
                jobId: job.jobId,
                error: err.message
            });
        }
    }

    private resolveJobTimestep(job: AnalysisJob): number {
        const direct = (job as any).timestep;
        if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

        const item: any = (job as any).forEachItem;
        const fromItem = (typeof item?.timestep === 'number' && Number.isFinite(item.timestep) && item.timestep) ||
            (typeof item?.frame === 'number' && Number.isFinite(item.frame) && item.frame);

        if (typeof fromItem === 'number') return fromItem;

        const idx = (job as any).forEachIndex;
        if (typeof idx === 'number' && Number.isFinite(idx)) return idx;

        return 0;
    }

    private async updateProgress(analysisId: string) {
        const updated = await Analysis.findOneAndUpdate(
            { _id: analysisId },
            {
                $inc: { completedFrames: 1 },
                $set: { clusterId: process.env.CLUSTER_ID || 'default' }
            },
            { new: true }
        ).lean();

        if (updated && updated.totalFrames && (updated.completedFrames ?? 0) >= updated.totalFrames) {
            await Analysis.updateOne(
                { _id: analysisId },
                { status: 'completed', finishedAt: new Date() }
            );
        }
    }

    private async handleListingPrecomputation(job: AnalysisJob, plugin: any, timestep: number) {
        try {
            const teamId = String((job as any).teamId || '');
            if (!teamId) {
                logger.warn(`[Worker #${process.pid}] Missing teamId in job ${job.jobId}; skipping precompute listing rows.`);
                return;
            }

            const listingSlugs = this.extractListingSlugs(plugin);
            if (listingSlugs.length) {
                await Promise.all(
                    listingSlugs.map((listingSlug) =>
                        precomputeListingRowsForTimesteps({
                            pluginId: String((plugin as any)._id),
                            teamId,
                            trajectoryId: String(job.trajectoryId),
                            analysisId: String(job.analysisId),
                            listingSlug,
                            timesteps: [timestep]
                        })
                    )
                );
            }
        } catch (e: any) {
            logger.warn(`[Worker #${process.pid}] Precompute listing rows failed for job ${job.jobId}: ${e?.message || e}`);
        }
    }

    private extractListingSlugs(plugin: any): string[] {
        const workflow = plugin?.workflow;
        if (!workflow?.nodes) return [];

        const result = new Set<string>();
        const exposures = workflow.nodes.filter((n: any) => n.type === NodeType.EXPOSURE);

        for (const exp of exposures) {
            const listingSlug = exp?.data?.exposure?.name;
            if (!listingSlug) continue;

            const visualizerNode = findDescendantByType(exp.id, workflow, NodeType.VISUALIZERS);
            const listing = visualizerNode?.data?.visualizers?.listing;

            if (listing && typeof listing === 'object' && Object.keys(listing).length > 0) {
                result.add(listingSlug);
            }
        }

        return Array.from(result);
    }
}

BaseWorker.start(AnalysisWorker);
