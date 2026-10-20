import type { AnalysisCreatedEventPayload } from '@shared/events/AnalysisCreatedPayload';
import type { AnalysisDeletedEventPayload } from '@shared/events/AnalysisDeletedPayload';
import type { AnalysisStageChangedEventPayload } from '@shared/events/AnalysisStageChangedPayload';
import type { AnalysisStatusChangedEventPayload } from '@shared/events/AnalysisStatusChangedPayload';

declare global {
    interface EventMap {
        'analysis.created': AnalysisCreatedEventPayload;
        'analysis.deleted': AnalysisDeletedEventPayload;
        'analysis.stage.changed': AnalysisStageChangedEventPayload;
        'analysis.status.changed': AnalysisStatusChangedEventPayload;
    }
}
