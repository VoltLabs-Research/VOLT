import type { DomainEventBridge } from '@shared/infrastructure/events/DomainEventBridge';
import type { EventMapperSet } from '@shared/infrastructure/events/event-mapper-registry';
import { registerStatusTriple } from '@shared/infrastructure/events/register-status-triple';
import {
    createAnalysisJobCompletionDedupeKey,
    createAnalysisJobCompletionMessage,
    createAnalysisJobStatusDedupeKey,
    createAnalysisJobStatusMessage,
    createAnalysisLogChunkMessage,
    createAnalysisProvenanceMessage,
    createAnalysisStageStatusDedupeKey,
    createAnalysisStageStatusMessage,
    createDebugLogChunkMessage
} from '@shared/contracts/channel/reverse-channel-analysis';
import {
    AnalysisCompletedEvent,
    AnalysisFailedEvent,
    AnalysisLogChunkReportedEvent,
    AnalysisStageStatusReportedEvent,
    AnalysisStartedEvent,
    AnalysisProvenanceRecordedEvent,
    DebugLogChunkReportedEvent,
    type BaseAnalysisEventData
} from '@modules/analysis/events/analysis-events';

type AnalysisLifecycleStatus = 'started' | 'completed' | 'failed';

export const registerAnalysisEventMappers: EventMapperSet = (bridge: DomainEventBridge): void => {
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

    bridge.register(AnalysisStageStatusReportedEvent, (payload, { messageContext }) => ({
        kind: 'buffered',
        message: createAnalysisStageStatusMessage(messageContext, payload),
        options: { dedupeKey: createAnalysisStageStatusDedupeKey(payload) }
    }));

    bridge.register(DebugLogChunkReportedEvent, (payload, { messageContext }) => ({
        kind: 'immediate',
        message: createDebugLogChunkMessage(messageContext, payload)
    }));

    bridge.register(AnalysisProvenanceRecordedEvent, (payload, { messageContext }) => ({
        kind: 'immediate',
        message: createAnalysisProvenanceMessage(messageContext, payload)
    }));
};
