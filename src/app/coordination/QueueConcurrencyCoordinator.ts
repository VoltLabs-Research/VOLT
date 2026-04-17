import { logger } from '@/core/logger';
import type { TeamClusterDaemonQueueConcurrency } from '@/core/runtime/contracts/teamClusterRuntime';
import type { AnalysisWorker } from '@/modules/analysis/application/execution/AnalysisWorker';
import type { SSHImportWorkerService } from '@/modules/trajectory/application/import/SSHImportWorkerService';
import type { TrajectoryGlbWorkerService } from '@/modules/trajectory/application/glb/TrajectoryGlbWorkerService';
import type { TrajectoryRasterWorkerService } from '@/modules/trajectory/application/raster/TrajectoryRasterWorkerService';

interface QueueConcurrencyCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
    sshImportWorkerService: SSHImportWorkerService;
}

export class QueueConcurrencyCoordinator {
    constructor(private readonly dependencies: QueueConcurrencyCoordinatorDependencies) {}

    apply(queueConcurrency: TeamClusterDaemonQueueConcurrency): void {
        this.dependencies.analysisWorker.setConcurrency(queueConcurrency.analysis);
        this.dependencies.trajectoryRasterWorkerService.setConcurrency(queueConcurrency.rasterizer);
        this.dependencies.trajectoryGlbWorkerService.setConcurrency(queueConcurrency.glbPreprocessing);
        this.dependencies.sshImportWorkerService.setConcurrency(queueConcurrency.sshImport);

        logger.info({ queueConcurrency }, 'Applied live queue concurrency to running workers');
    }
}
