import { Service } from '@/core/decorators/service';
import type { TeamClusterDaemonQueueConcurrency } from '@/core/runtime/contracts/team-cluster-runtime';
import type { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import type { ArtifactUploadWorker } from '@/modules/plugin/application/artifacts/ArtifactUploadWorker';
import type { PluginWarmupWorker } from '@/modules/plugin/application/binaries/PluginWarmupWorker';
import type { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import type { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';

@Service('queueConcurrencyCoordinator')
export class QueueConcurrencyCoordinator {
    constructor(
        private readonly analysisWorker: AnalysisWorker,
        private readonly trajectoryRasterWorker: TrajectoryRasterWorker,
        private readonly trajectoryGlbWorker: TrajectoryGlbWorker,
        private readonly artifactUploadWorker: ArtifactUploadWorker,
        private readonly pluginWarmupWorker: PluginWarmupWorker
    ) {}

    apply(queueConcurrency: TeamClusterDaemonQueueConcurrency): void {
        this.analysisWorker.setConcurrency(queueConcurrency.analysis);
        this.trajectoryRasterWorker.setConcurrency(queueConcurrency.rasterizer);
        this.trajectoryGlbWorker.setConcurrency(queueConcurrency.glbPreprocessing);
        this.artifactUploadWorker.setConcurrency(queueConcurrency.artifactUpload);
        this.pluginWarmupWorker.setConcurrency(queueConcurrency.pluginWarmup);
    }
}
