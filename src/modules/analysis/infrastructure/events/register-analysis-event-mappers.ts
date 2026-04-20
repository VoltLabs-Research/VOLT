import type { DomainEventBridge } from '@/core/reverse-channel/infrastructure/events/DomainEventBridge';
import { registerStatusTriple } from '@/core/reverse-channel/infrastructure/events/register-status-triple';
import {
    createAnalysisJobCompletionDedupeKey,
    createAnalysisJobCompletionMessage,
    createAnalysisJobStatusDedupeKey,
    createAnalysisJobStatusMessage,
    createAnalysisLogChunkMessage,
    createDebugLogChunkMessage
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import {
    AnalysisCompletedEvent,
    AnalysisFailedEvent,
    AnalysisLogChunkReportedEvent,
    AnalysisStartedEvent,
    DebugLogChunkReportedEvent,
    type BaseAnalysisEventData
} from '@/modules/analysis/domain/events';

type AnalysisLifecycleStatus = 'started' | 'completed' | 'failed';

export const registerAnalysisEventMappers = (bridge: DomainEventBridge): void => {
    registerStatusTriple<BaseAnalysisEventData, AnalysisLifecycleStatus>({
        bridge,
        events: {
            started: AnalysisStartedEvent,
            completed: AnalysisCompletedEvent,
            failed: AnalysisFailedEvent
        },
        buildMessage: (ctx, payload, status) => status === 'started'
            ? createAnalysisJobStatusMessage(ctx, payload)
            : createAnalysisJobCompletionMessage(ctx, payload),
        buildDedupeKey: (payload, status) => status === 'started'
            ? createAnalysisJobStatusDedupeKey(payload)
            : createAnalysisJobCompletionDedupeKey(payload)
    });

    bridge.register(AnalysisLogChunkReportedEvent, (payload, { messageContext }) => ({
        kind: 'immediate',
        message: createAnalysisLogChunkMessage(messageContext, payload)
    }));

    bridge.register(DebugLogChunkReportedEvent, (payload, { messageContext }) => ({
        kind: 'immediate',
        message: createDebugLogChunkMessage(messageContext, payload)
    }));
};
