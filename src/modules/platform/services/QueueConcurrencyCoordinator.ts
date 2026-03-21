import { logger } from '@/core/logger';
import type { AnalysisWorker } from '@/modules/job-runtime/services';
import type { SSHImportWorkerService } from '@/modules/ssh-import/services';
import type {
    TrajectoryGlbWorkerService,
    TrajectoryRasterWorkerService
} from '@/modules/trajectory-native/services';
import type { TeamClusterDaemonQueueConcurrency } from '@/shared/contracts';

interface QueueConcurrencyCoordinatorDependencies {
    analysisWorker: AnalysisWorker;
    trajectoryRasterWorkerService: TrajectoryRasterWorkerService;
    trajectoryGlbWorkerService: TrajectoryGlbWorkerService;
    sshImportWorkerService: SSHImportWorkerService;
};

export class QueueConcurrencyCoordinator {
    private dependencies: QueueConcurrencyCoordinatorDependencies | null = null;

    bind(dependencies: QueueConcurrencyCoordinatorDependencies): void {
        this.dependencies = dependencies;
    }

    apply(queueConcurrency: TeamClusterDaemonQueueConcurrency): void {
        if (!this.dependencies) {
            throw new Error('QueueConcurrencyCoordinator dependencies are not bound');
        }

        this.dependencies.analysisWorker.setConcurrency(queueConcurrency.analysis);
        this.dependencies.trajectoryRasterWorkerService.setConcurrency(queueConcurrency.rasterizer);
        this.dependencies.trajectoryGlbWorkerService.setConcurrency(queueConcurrency.glbPreprocessing);
        this.dependencies.sshImportWorkerService.setConcurrency(queueConcurrency.sshImport);

        logger.info({ queueConcurrency }, 'Applied live queue concurrency to running workers');
    }
};
