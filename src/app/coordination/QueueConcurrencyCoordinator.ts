import { Service } from '@/core/decorators/service';
import type { TeamClusterDaemonQueueConcurrency } from '@/core/runtime/contracts/team-cluster-runtime';
import type { AnalysisWorker } from '@/modules/analysis/application/workers/AnalysisWorker';
import type { SSHImportWorker } from '@/modules/trajectory/application/import/SSHImportWorker';
import type { TrajectoryGlbWorker } from '@/modules/trajectory/application/glb/TrajectoryGlbWorker';
import type { TrajectoryRasterWorker } from '@/modules/trajectory/application/raster/TrajectoryRasterWorker';

@Service('queueConcurrencyCoordinator')
export class QueueConcurrencyCoordinator {
    constructor(
        private readonly analysisWorker: AnalysisWorker,
        private readonly trajectoryRasterWorker: TrajectoryRasterWorker,
        private readonly trajectoryGlbWorker: TrajectoryGlbWorker,
        private readonly sshImportWorker: SSHImportWorker
    ) {}

    apply(queueConcurrency: TeamClusterDaemonQueueConcurrency): void {
        this.analysisWorker.setConcurrency(queueConcurrency.analysis);
        this.trajectoryRasterWorker.setConcurrency(queueConcurrency.rasterizer);
        this.trajectoryGlbWorker.setConcurrency(queueConcurrency.glbPreprocessing);
        this.sshImportWorker.setConcurrency(queueConcurrency.sshImport);
    }
}
