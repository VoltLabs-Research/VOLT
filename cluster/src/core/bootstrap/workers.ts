import type { WorkerBinding } from '@shared/infrastructure/queues/worker-registry';
import { analysisWorker } from '@modules/analysis/workers/AnalysisWorker';
import { pipelineWorker } from '@modules/analysis/workers/PipelineWorker';
import { artifactUploadWorker } from '@modules/plugin/workers/ArtifactUploadWorker';
import { pluginWarmupWorker } from '@modules/plugin/workers/PluginWarmupWorker';
import { trajectoryFrameProcessingWorker } from '@modules/trajectory/workers/TrajectoryFrameProcessingWorker';
import { trajectoryGlbWorker } from '@modules/trajectory/workers/TrajectoryGlbWorker';
import { trajectoryRasterWorker } from '@modules/trajectory/workers/TrajectoryRasterWorker';

export const DAEMON_WORKERS: readonly WorkerBinding[] = [
    trajectoryFrameProcessingWorker,
    trajectoryRasterWorker,
    trajectoryGlbWorker,
    analysisWorker,
    pipelineWorker,
    artifactUploadWorker,
    pluginWarmupWorker
];
