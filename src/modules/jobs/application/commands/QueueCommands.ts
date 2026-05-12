import { Command, CommandGroup } from '@/core/commands/decorators';
import type { QueueService } from '@/core/queues/application/QueueService';
import { ANALYSIS_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';

interface QueueDispatchRequest {
    queueName: string;
    payload: Record<string, unknown>;
}

const DISPATCHABLE_QUEUE_NAMES = new Set<string>([
    ANALYSIS_QUEUE_NAME,
    TRAJECTORY_RASTER_QUEUE_NAME,
    TRAJECTORY_GLB_QUEUE_NAME
]);

@CommandGroup('queue')
export class QueueCommands {
    constructor(private readonly queueService: QueueService) {}

    @Command('dispatch')
    async dispatch(payload: QueueDispatchRequest) {
        if (!DISPATCHABLE_QUEUE_NAMES.has(payload.queueName)) {
            throw new Error(`Unsupported queue dispatch target: ${payload.queueName}`);
        }
        if (payload.queueName === ANALYSIS_QUEUE_NAME) {
            const hasExecutionDataReference = typeof payload.payload.executionDataReference === 'object'
                && payload.payload.executionDataReference !== null;
            if (!hasExecutionDataReference) {
                throw new Error('Analysis queue payload requires executionDataReference');
            }
        }

        await this.queueService.enqueue(payload.queueName, payload.payload);

        return { queued: true };
    }
}
