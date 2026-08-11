import { singleton } from '@shared/application/utilities/singleton';
import { defineDaemonWorker } from '@shared/infrastructure/queues/worker-registry';
import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { getQueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { getGlbExporter } from '@modules/trajectory/services/glb/GlbExporter';
import { getDaemonJobReporter } from '@modules/jobs/services/DaemonJobReporter';
import type { QueueJobHandle } from '@shared/infrastructure/queues/queue-job-handle';

import { BaseWorker } from '@shared/infrastructure/queues/BaseWorker';
import { createLifecycleStatusReporter } from '@shared/infrastructure/queues/create-status-reporter';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@shared/infrastructure/queues/QueueScopeLimitsRegistry';
import { isFinalAttempt, withJobLifecycle } from '@shared/infrastructure/queues/with-job-lifecycle';
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

export const trajectoryGlbWorker = defineDaemonWorker({
    name: 'trajectory-glb',
    scope: 'compute',
    concurrencyKey: 'glbPreprocessing',
    tracksConcurrencyWhileRunning: true
}, singleton((): TrajectoryGlbWorker => new TrajectoryGlbWorker(getQueueService(), getQueueScopeLimitsRegistry(), getGlbExporter(), getDaemonJobReporter())));
