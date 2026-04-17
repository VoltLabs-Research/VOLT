import { createAnalysisJobCompletionDedupeKey, createAnalysisJobCompletionMessage } from '@/core/reverse-channel/contracts/messages/analysis-job-completion';
import { createAnalysisJobStatusDedupeKey, createAnalysisJobStatusMessage } from '@/core/reverse-channel/contracts/messages/analysis-job-status';
import { createAnalysisLogChunkMessage } from '@/core/reverse-channel/contracts/messages/analysis-log-chunk';
import { createDebugLogChunkMessage } from '@/core/reverse-channel/contracts/messages/debug-log-chunk';
import { BufferedTransportEventSubscriber, ImmediateTransportEventSubscriber } from '@/core/reverse-channel/infrastructure/events/TransportEventSubscriber';
import { AnalysisLogChunkReportedEvent } from '@/modules/analysis/application/events/AnalysisLogChunkReportedEvent';
import { DebugLogChunkReportedEvent } from '@/modules/analysis/application/events/DebugLogChunkReportedEvent';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/events/AnalysisCompletedEvent';
import { AnalysisFailedEvent } from '@/modules/analysis/domain/events/AnalysisFailedEvent';
import { AnalysisStartedEvent } from '@/modules/analysis/domain/events/AnalysisStartedEvent';

class AnalysisBufferedSubscriber<TEvent extends AnalysisStartedEvent | AnalysisCompletedEvent | AnalysisFailedEvent>
    extends BufferedTransportEventSubscriber<TEvent> {
    protected getDedupeKey(event: TEvent): string {
        if (event instanceof AnalysisStartedEvent) {
            return createAnalysisJobStatusDedupeKey(event.payload);
        }

        return createAnalysisJobCompletionDedupeKey(event.payload);
    }
}

export class AnalysisStartedEventSubscriber extends AnalysisBufferedSubscriber<AnalysisStartedEvent> {
    static readonly subscribedTo = AnalysisStartedEvent.eventName;

    protected buildMessage(event: AnalysisStartedEvent) {
        return createAnalysisJobStatusMessage(this.getMessageContext(), event.payload);
    }
}

export class AnalysisCompletedEventSubscriber extends AnalysisBufferedSubscriber<AnalysisCompletedEvent> {
    static readonly subscribedTo = AnalysisCompletedEvent.eventName;

    protected buildMessage(event: AnalysisCompletedEvent) {
        return createAnalysisJobCompletionMessage(this.getMessageContext(), event.payload);
    }
}

export class AnalysisFailedEventSubscriber extends AnalysisBufferedSubscriber<AnalysisFailedEvent> {
    static readonly subscribedTo = AnalysisFailedEvent.eventName;

    protected buildMessage(event: AnalysisFailedEvent) {
        return createAnalysisJobCompletionMessage(this.getMessageContext(), event.payload);
    }
}

export class AnalysisLogChunkReportedEventSubscriber extends ImmediateTransportEventSubscriber<AnalysisLogChunkReportedEvent> {
    static readonly subscribedTo = AnalysisLogChunkReportedEvent.eventName;

    protected buildMessage(event: AnalysisLogChunkReportedEvent) {
        return createAnalysisLogChunkMessage(this.getMessageContext(), event.payload);
    }
}

export class DebugLogChunkReportedEventSubscriber extends ImmediateTransportEventSubscriber<DebugLogChunkReportedEvent> {
    static readonly subscribedTo = DebugLogChunkReportedEvent.eventName;

    protected buildMessage(event: DebugLogChunkReportedEvent) {
        return createDebugLogChunkMessage(this.getMessageContext(), event.payload);
    }
}
