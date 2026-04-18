import { EventGroup, OnEvent } from '@/core/events/decorators';
import { ClusterDaemonTransportEvents } from '@/core/reverse-channel/infrastructure/events/ClusterDaemonTransportEvents';
import type { ClusterDaemonEventPublisher } from '@/core/reverse-channel/infrastructure/events/cluster-daemon-event-publisher';
import { AnalysisLogChunkReportedEvent } from '@/modules/analysis/application/events/AnalysisLogChunkReportedEvent';
import {
    createAnalysisJobCompletionDedupeKey,
    createAnalysisJobCompletionMessage,
    createAnalysisJobStatusDedupeKey,
    createAnalysisJobStatusMessage,
    createAnalysisLogChunkMessage,
    createDebugLogChunkMessage
} from '@/modules/analysis/contracts/reverse-channel-analysis';
import { DebugLogChunkReportedEvent } from '@/modules/analysis/application/events/DebugLogChunkReportedEvent';
import { AnalysisCompletedEvent } from '@/modules/analysis/domain/events/AnalysisCompletedEvent';
import { AnalysisFailedEvent } from '@/modules/analysis/domain/events/AnalysisFailedEvent';
import { AnalysisStartedEvent } from '@/modules/analysis/domain/events/AnalysisStartedEvent';

@EventGroup('analysis')
export class AnalysisEvents extends ClusterDaemonTransportEvents {
    constructor(voltCloudConnection: ClusterDaemonEventPublisher) {
        super(voltCloudConnection);
    }

    @OnEvent('started')
    started(event: AnalysisStartedEvent): void {
        this.emitBufferedMessage(
            createAnalysisJobStatusMessage(this.getMessageContext(), event.payload),
            { dedupeKey: createAnalysisJobStatusDedupeKey(event.payload) }
        );
    }

    @OnEvent('completed')
    completed(event: AnalysisCompletedEvent): void {
        this.emitBufferedMessage(
            createAnalysisJobCompletionMessage(this.getMessageContext(), event.payload),
            { dedupeKey: createAnalysisJobCompletionDedupeKey(event.payload) }
        );
    }

    @OnEvent('failed')
    failed(event: AnalysisFailedEvent): void {
        this.emitBufferedMessage(
            createAnalysisJobCompletionMessage(this.getMessageContext(), event.payload),
            { dedupeKey: createAnalysisJobCompletionDedupeKey(event.payload) }
        );
    }

    @OnEvent('log-chunk-reported')
    logChunkReported(event: AnalysisLogChunkReportedEvent): void {
        this.emitMessage(createAnalysisLogChunkMessage(this.getMessageContext(), event.payload));
    }

    @OnEvent('debug-log-chunk-reported')
    debugLogChunkReported(event: DebugLogChunkReportedEvent): void {
        this.emitMessage(createDebugLogChunkMessage(this.getMessageContext(), event.payload));
    }
}
