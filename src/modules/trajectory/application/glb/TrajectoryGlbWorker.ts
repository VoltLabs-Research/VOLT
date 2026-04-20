import { type Job } from 'bullmq';

import { Service } from '@/core/decorators/service';
import { BaseWorker } from '@/core/queues/application/BaseWorker';
import { createLifecycleStatusReporter } from '@/core/queues/application/create-status-reporter';
import type { QueueService } from '@/core/queues/application/QueueService';
import { withJobLifecycle } from '@/core/queues/application/with-job-lifecycle';
import { TRAJECTORY_GLB_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import type { GlbConversionQueueJobPayload } from '@/contracts';
import type { GlbExporter } from '@/modules/trajectory/application/glb/GlbExporter';
import type { DaemonJobReporter } from '@/modules/jobs/application/reporting/DaemonJobReporter';

@Service('trajectoryGlbWorker')
export class TrajectoryGlbWorker extends BaseWorker<GlbConversionQueueJobPayload> {
    protected readonly queueName = TRAJECTORY_GLB_QUEUE_NAME;
    private readonly buildStatusReporter: ReturnType<typeof createLifecycleStatusReporter<GlbConversionQueueJobPayload>>;

    constructor(
        queueService: QueueService,
        private readonly glbExporter: GlbExporter,
        daemonJobReporter: DaemonJobReporter
    ) {
        super({ queueService });
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
        await withJobLifecycle(
            {
                reportStatus: this.buildStatusReporter(payload),
                progress: (value) => bullJob.updateProgress(value)
            },
            () => this.glbExporter.preprocessTrajectory(payload)
        );
    }
}
