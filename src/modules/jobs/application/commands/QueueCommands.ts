import type { AnalysisJobExecutionData, AnalysisQueueJobPayload } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import type { QueueService } from '@/core/queues/application/QueueService';
import { ANALYSIS_QUEUE_NAME, SSH_IMPORT_QUEUE_NAME, TRAJECTORY_GLB_QUEUE_NAME, TRAJECTORY_RASTER_QUEUE_NAME } from '@/core/queues/contracts/queue-names';
import { inflateAnalysisExecutionData } from '@/support/policies/analysis-execution-data';

interface QueueDispatchRequest {
    queueName: string;
    payload: Record<string, unknown>;
}

const DISPATCHABLE_QUEUE_NAMES = new Set<string>([
    ANALYSIS_QUEUE_NAME,
    SSH_IMPORT_QUEUE_NAME,
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

        await this.queueService.enqueue(
            payload.queueName,
            payload.queueName === ANALYSIS_QUEUE_NAME
                ? this.normalizeAnalysisQueuePayload(payload.payload)
                : payload.payload
        );

        return { queued: true };
    }

    private normalizeAnalysisQueuePayload(payload: Record<string, unknown>): Record<string, unknown> {
        const executionDataCompressed = payload.executionDataCompressed;
        const normalizedPayload = {
            ...payload,
            metadata: (payload.metadata as Record<string, unknown> | undefined) ?? {}
        } as AnalysisQueueJobPayload;

        if (typeof executionDataCompressed === 'string' && !normalizedPayload.executionData) {
            normalizedPayload.executionData = this.readCompressedAnalysisExecutionData(executionDataCompressed);
        }

        return normalizedPayload;
    }

    private readCompressedAnalysisExecutionData(value: unknown): AnalysisJobExecutionData {
        return inflateAnalysisExecutionData(value as string);
    }
}
