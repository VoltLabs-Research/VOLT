import { singleton } from '@shared/utilities/singleton';
import type { WorkerBinding } from '@shared/queues/worker-registry';
import { getQueueService } from '@shared/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { getGlbExporter } from '@modules/trajectory/services/glb/GlbExporter';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { QueueJobHandle } from '@shared/queues/queue-job-handle';

import { BaseWorker } from '@shared/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/queues/create-status-reporter';
import type { QueueService } from '@shared/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/queues/QueueScopeLimitsRegistry';
import { isFinalAttempt, withJobLifecycle } from '@shared/queues/with-job-lifecycle';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@core/constants/queue-names';
import type { GlbConversionQueueJobPayload } from '@shared/contracts/types/queue-trajectory';
import type { GlbExporter } from '@modules/trajectory/services/glb/GlbExporter';
import type { DaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';

export class TrajectoryGlbWorker extends BaseWorker<GlbConversionQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_GLB_QUEUE_NAME;
    protected readonly scopeKey: QueueScopeKey = 'trajectoryGlbConversion';
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<GlbConversionQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        queueScopeLimitsRegistry: QueueScopeLimitsRegistry,
        private readonly glbExporter: GlbExporter,
        daemonJobReporter: DaemonJobReporter
    ) {
        super({
            queueService,
            scopeLimitsRegistry: queueScopeLimitsRegistry
        });
        this.buildStatusReporter = createLifecycleStatusReporter<GlbConversionQueueJobPayload>(
            {
                started: daemonJobReporter.reportGlbStarted,
                completed: daemonJobReporter.reportGlbCompleted,
                failed: daemonJobReporter.reportGlbFailed
            },
            'trajectory GLB'
        );
    }

    protected async process(payload: GlbConversionQueueJobPayload, job: QueueJobHandle<GlbConversionQueueJobPayload>): Promise<void> {
        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(job)
            },
            () => this.glbExporter.preprocessTrajectory(payload)
        );
    }
}

export const trajectoryGlbWorker: WorkerBinding = {
    name: 'trajectory-glb',
    scope: 'compute',
    concurrencyKey: 'glbPreprocessing',
    tracksConcurrencyWhileRunning: true,
    resolve: singleton((): TrajectoryGlbWorker => new TrajectoryGlbWorker(getQueueService(), getQueueScopeLimitsRegistry(), getGlbExporter(), getDaemonJobReporter()))
};
