/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished dto do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { parentPort } from 'node:worker_threads';
import { Analysis, Plugin } from '@/models';
import { AnalysisJob } from '@/types/queues/analysis-processing-queue';
import PluginWorkflowEngine from '@/services/plugin-workflow-engine';
import mongoConnector from '@/utilities/mongo/mongo-connector';
import logger from '@/logger';
import '@config/env';
import '@/services/nodes/handlers';
import { NodeType } from '@/types/models/plugin';
import { precomputeListingRowsForTimesteps } from '@/services/precompute-listing-row';
import DumpStorage from '@/services/dump-storage';
import path from 'node:path';

const extractListingSlugs = (plugin: any): string[] => {
    const nodes = plugin?.workflow?.nodes || [];
    const edges = plugin?.workflow?.edges || [];

    // construir adjacency (source -> [targets])
    const outMap = new Map<string, string[]>();
    for (const e of edges) {
        const arr = outMap.get(e.source) || [];
        arr.push(e.target);
        outMap.set(e.source, arr);
    }

    const result = new Set<string>();
    const exposures = nodes.filter((n: any) => n.type === NodeType.EXPOSURE);

    for (const exp of exposures) {
        const listingSlug = exp?.data?.exposure?.name;
        if (!listingSlug) continue;

        const q = [exp.id];
        const visited = new Set<string>();

        while (q.length) {
            const id = q.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);

            const children = outMap.get(id) || [];
            for (const childId of children) {
                const child = nodes.find((x: any) => x.id === childId);
                if (!child) continue;

                const listing = child?.data?.visualizers?.listing;
                const hasListing =
                    child.type === NodeType.VISUALIZERS &&
                    listing &&
                    typeof listing === 'object' &&
                    Object.keys(listing).length > 0;

                if (hasListing) {
                    result.add(listingSlug);
                    q.length = 0; // early exit BFS para este exposure
                    break;
                }

                q.push(childId);
            }
        }
    }

    return Array.from(result);
};

/**
 * Determina el timestep real del job con fallbacks razonables.
 */
const resolveJobTimestep = (job: AnalysisJob): number => {
    // Si tu AnalysisJob ya trae timestep, ideal.
    const direct = (job as any).timestep;
    if (typeof direct === 'number' && Number.isFinite(direct)) return direct;

    // Fallbacks comunes si no lo traes:
    const item: any = (job as any).forEachItem;
    const fromItem =
        (typeof item?.timestep === 'number' && Number.isFinite(item.timestep) && item.timestep) ||
        (typeof item?.frame === 'number' && Number.isFinite(item.frame) && item.frame);

    if (typeof fromItem === 'number') return fromItem;

    // último fallback: index
    const idx = (job as any).forEachIndex;
    if (typeof idx === 'number' && Number.isFinite(idx)) return idx;

    return 0;
};

const processJob = async (job: AnalysisJob): Promise<void> => {
    if (!job) {
        throw new Error('No job data received in message.');
    }

    try {
        const frameTimestep = resolveJobTimestep(job);
        const exists = await DumpStorage.exists(job.trajectoryId, frameTimestep);

        if (!exists) {
            logger.info(`[Worker #${process.pid}] Frame ${frameTimestep} not found in MinIO. Requesting wait status.`);
            parentPort?.postMessage({
                status: 'waiting_for_upload',
                jobId: job.jobId,
                trajectoryId: job.trajectoryId,
                timestep: frameTimestep
            });
            return;
        }

        logger.info(`[Worker #${process.pid}] Received job ${job.jobId}. Starting processing...`);

        const plugin = await Plugin.findOne({ slug: job.plugin }).lean();
        if (!plugin) {
            throw new Error(`Plugin not found: ${job.plugin}`);
        }

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

        // Increment completed frames counter
        const updated = await Analysis.findOneAndUpdate(
            { _id: job.analysisId },
            {
                $inc: { completedFrames: 1 },
                $set: { clusterId: process.env.CLUSTER_ID || 'default' }
            },
            { new: true }
        ).lean();

        // Mark as completed if all frames are done
        if (updated && updated.totalFrames && (updated.completedFrames ?? 0) >= updated.totalFrames) {
            await Analysis.updateOne(
                { _id: job.analysisId },
                { status: 'completed', finishedAt: new Date() }
            );
        }

        // Precompute listing rows (NO MinIO)
        try {
            const teamId = String((job as any).teamId || '');
            if (teamId) {
                const timestep = resolveJobTimestep(job);
                const listingSlugs = extractListingSlugs(plugin);

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
            } else {
                logger.warn(
                    `[Worker #${process.pid}] Missing teamId in job ${job.jobId}; skipping precompute listing rows.`
                );
            }
        } catch (e: any) {
            logger.warn(
                `[Worker #${process.pid}] Precompute listing rows failed for job ${job.jobId}: ${e?.message || e}`
            );
        }

        parentPort?.postMessage({
            status: 'completed',
            jobId: job.jobId,
            timestep: job.timestep,
            result: null
        });

        logger.info(`[Worker #${process.pid}] Finished job ${job.jobId} successfully.`);
    } catch (err: any) {
        logger.error(`[Worker #${process.pid}] An error occurred while processing job ${job.jobId}: ${err}`);

        await Analysis.updateOne(
            { _id: job.analysisId },
            { status: 'failed', finishedAt: new Date() }
        ).catch(() => { /** noop */ });

        parentPort?.postMessage({
            status: 'failed',
            timestep: job.timestep,
            jobId: job.jobId,
            error: err.message
        });
    }
};

const main = async () => {
    try {
        await mongoConnector();
        logger.info(`[Worker #${process.pid}] Connected to MongoDB and ready to process jobs.`);
    } catch (dbError) {
        logger.error(`[Worker #${process.pid}] Failed to connect to MongoDB. Worker will not be able to process jobs: ${dbError}`);
        process.exit(1);
    }

    parentPort?.on('message', (message: { job: AnalysisJob }) => {
        processJob(message.job);
    });
};

main();
