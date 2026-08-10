import type { WorkerBinding } from '@shared/infrastructure/queues/worker-registry';
import { analysisWorker } from '@modules/analysis/workers/AnalysisWorker';
import { pipelineWorker } from '@modules/analysis/workers/PipelineWorker';
import { artifactUploadWorker } from '@modules/plugin/workers/ArtifactUploadWorker';
import { pluginWarmupWorker } from '@modules/plugin/workers/PluginWarmupWorker';
import { trajectoryFrameProcessingWorker } from '@modules/trajectory/workers/TrajectoryFrameProcessingWorker';
import { trajectoryGlbWorker } from '@modules/trajectory/workers/TrajectoryGlbWorker';
import { trajectoryRasterWorker } from '@modules/trajectory/workers/TrajectoryRasterWorker';

/**
 * Every queue worker the daemon runs, named.
 *
 * Workers used to enter a module-level array as a side effect of being imported,
 * which worked only because the daemon imported all 233 files under `shared/` and
 * `modules/` at boot. Removing that autoloader left nothing importing these seven
 * files, so the array was empty and the daemon came up with no workers at all:
 * jobs kept being enqueued, none were ever claimed, and the only symptom was
 * `@runtime-role: started 0 compute workers` in the log.
 *
 * Adding a worker is now two lines — the file, and its name here. That is the
 * whole cost of letting `tsc`, the bundler and "find references" see the wiring,
 * and of making an unlisted worker read as dead code instead of as a queue that
 * quietly stops draining.
 */
export const DAEMON_WORKERS: readonly WorkerBinding[] = [
    trajectoryFrameProcessingWorker,
    trajectoryRasterWorker,
    trajectoryGlbWorker,
    analysisWorker,
    pipelineWorker,
    artifactUploadWorker,
    pluginWarmupWorker
];
