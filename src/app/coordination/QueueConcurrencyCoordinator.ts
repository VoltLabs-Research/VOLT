import { logger } from '@/core/logger';
import type { TeamClusterDaemonQueueConcurrency } from '@/core/runtime/contracts/team-cluster-runtime';
import type { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import type { SSHImportWorker } from '@/modules/trajectory/application/import/SSHImportWorker';
import type { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import type { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';

interface QueueConcurrencyCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    trajectoryRasterWorker: TrajectoryRasterWorker;
    trajectoryGlbWorker: TrajectoryGlbWorker;
    sshImportWorker: SSHImportWorker;
}

export class QueueConcurrencyCoordinator {
    constructor(private readonly dependencies: QueueConcurrencyCoordinatorDependencies) {}

    apply(queueConcurrency: TeamClusterDaemonQueueConcurrency): void {
        this.dependencies.analysisWorker.setConcurrency(queueConcurrency.analysis);
        this.dependencies.trajectoryRasterWorker.setConcurrency(queueConcurrency.rasterizer);
        this.dependencies.trajectoryGlbWorker.setConcurrency(queueConcurrency.glbPreprocessing);
        this.dependencies.sshImportWorker.setConcurrency(queueConcurrency.sshImport);
    }
}
