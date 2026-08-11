import type { AnalysisCreatedEventPayload } from '@shared/contracts/events/AnalysisCreatedPayload';
import type { AnalysisDeletedEventPayload } from '@shared/contracts/events/AnalysisDeletedPayload';
import type { AnalysisStageChangedEventPayload } from '@shared/contracts/events/AnalysisStageChangedPayload';
import type { AnalysisStatusChangedEventPayload } from '@shared/contracts/events/AnalysisStatusChangedPayload';

declare global {
    interface EventMap {
        'analysis.created': AnalysisCreatedEventPayload;
        'analysis.deleted': AnalysisDeletedEventPayload;
        'analysis.stage.changed': AnalysisStageChangedEventPayload;
        'analysis.status.changed': AnalysisStatusChangedEventPayload;
    }
}
