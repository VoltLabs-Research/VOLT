import { getQueueService } from '@shared/infrastructure/queues/QueueService';
import { Command, CommandGroup, commandGroupFactory } from '@shared/commands/command';
import type { QueueService } from '@shared/infrastructure/queues/QueueService';
import { ANALYSIS_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@core/constants/queue-names';

type DispatchableQueueName =
    | typeof ANALYSIS_QUEUE_NAME
    | typeof TRAJECTORY_RASTER_QUEUE_NAME
    | typeof TRAJECTORY_GLB_QUEUE_NAME;

interface QueueDispatchRequest {
    queueName: DispatchableQueueName;
    payload: Record<string, unknown>;
}

/**
 * Bounds what a remote dispatch may reach: an unknown name would silently create a
 * new queue, so this stays an authorization check rather than type revalidation.
 */
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

        await this.queueService.enqueue(payload.queueName, payload.payload);

        return { queued: true };
    }
}

export const getQueueCommands = commandGroupFactory(QueueCommands, () => new QueueCommands(getQueueService()));
