import { type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { QueueScopeKey, QueueScopeLimitsRegistry } from '@/core/queues/application/QueueScopeLimitsRegistry';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { GlbConversionQueueJobPayload } from '@/contracts';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

@Service('trajectoryGlbWorker')
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
        super({ queueService, scopeLimitsRegistry: queueScopeLimitsRegistry });
        this.buildStatusReporter = createLifecycleStatusReporter<GlbConversionQueueJobPayload>(
            {
                started: daemonJobReporter.reportGlbStarted,
                completed: daemonJobReporter.reportGlbCompleted,
                failed: daemonJobReporter.reportGlbFailed
            },
            'trajectory GLB'
        );
    }

    protected async process(payload: GlbConversionQueueJobPayload, bullJob: Job<GlbConversionQueueJobPayload>): Promise<void> {
        const maxAttempts = typeof bullJob.opts.attempts === 'number' ? bullJob.opts.attempts : 1;
        const isFinalAttempt = () => bullJob.attemptsMade + 1 >= maxAttempts;

        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                shouldReportTerminal: () => isFinalAttempt(),
                progress: (value) => bullJob.updateProgress(value)
            },
            () => this.glbExporter.preprocessTrajectory(payload)
        );
    }
}
