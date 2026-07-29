import { getEnabledModules } from '@core/bootstrap/module-state';
import { getAnalysisWorker } from '@modules/analysis/workers/AnalysisWorker';
import { getPipelineWorker } from '@modules/analysis/workers/PipelineWorker';
import { getArtifactUploadWorker } from '@modules/plugin/workers/ArtifactUploadWorker';
import { getPluginWarmupWorker } from '@modules/plugin/workers/PluginWarmupWorker';
import { getTrajectoryFrameProcessingWorker } from '@modules/trajectory/workers/TrajectoryFrameProcessingWorker';
import { getTrajectoryGlbWorker } from '@modules/trajectory/workers/TrajectoryGlbWorker';
import { getTrajectoryRasterWorker } from '@modules/trajectory/workers/TrajectoryRasterWorker';
import type { TeamClusterDaemonQueueConcurrency } from '@shared/contracts/types/team-cluster-runtime';

export type WorkerStartScope = 'always' | 'compute';

interface ManagedWorker {
    start(concurrency: number): void;
    stop(): Promise<void>;
    setConcurrency(concurrency: number): void;
}

export interface WorkerBinding {
    name: string;
    moduleKey: string;
    scope: WorkerStartScope;
    concurrencyKey: keyof TeamClusterDaemonQueueConcurrency;
    tracksConcurrencyWhileRunning: boolean;
    resolve: () => ManagedWorker;
}

const WORKERS: readonly WorkerBinding[] = [
    {
        name: 'trajectory-frame-processing',
        moduleKey: 'trajectory',
        scope: 'always',
        concurrencyKey: 'glbPreprocessing',
        tracksConcurrencyWhileRunning: false,
        resolve: getTrajectoryFrameProcessingWorker
    },
    {
        name: 'trajectory-raster',
        moduleKey: 'trajectory',
        scope: 'always',
        concurrencyKey: 'rasterizer',
        tracksConcurrencyWhileRunning: true,
        resolve: getTrajectoryRasterWorker
    },
    {
        name: 'analysis',
        moduleKey: 'analysis',
        scope: 'compute',
        concurrencyKey: 'analysis',
        tracksConcurrencyWhileRunning: true,
        resolve: getAnalysisWorker
    },
    {
        name: 'pipeline',
        moduleKey: 'analysis',
        scope: 'compute',
        concurrencyKey: 'analysis',
        tracksConcurrencyWhileRunning: true,
        resolve: getPipelineWorker
    },
    {
        name: 'artifact-upload',
        moduleKey: 'plugin',
        scope: 'compute',
        concurrencyKey: 'artifactUpload',
        tracksConcurrencyWhileRunning: true,
        resolve: getArtifactUploadWorker
    },
    {
        name: 'plugin-warmup',
        moduleKey: 'plugin',
        scope: 'compute',
        concurrencyKey: 'pluginWarmup',
        tracksConcurrencyWhileRunning: true,
        resolve: getPluginWarmupWorker
    },
    {
        name: 'trajectory-glb',
        moduleKey: 'trajectory',
        scope: 'compute',
        concurrencyKey: 'glbPreprocessing',
        tracksConcurrencyWhileRunning: true,
        resolve: getTrajectoryGlbWorker
    }
];

export const mountWorkers = (scope: WorkerStartScope): readonly WorkerBinding[] => {
    const enabled = getEnabledModules();
    return WORKERS.filter((worker) => worker.scope === scope && enabled.has(worker.moduleKey));
};

export const mountConcurrencyTrackedWorkers = (): readonly WorkerBinding[] => {
    const enabled = getEnabledModules();
    return WORKERS.filter((worker) => worker.tracksConcurrencyWhileRunning && enabled.has(worker.moduleKey));
};
