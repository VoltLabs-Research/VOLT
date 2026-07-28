import type {
    AnalysisCreatedEventPayload,
    AnalysisDeletedEventPayload,
    AnalysisStageChangedEventPayload,
    AnalysisStatusChangedEventPayload
} from '@shared/contracts/events';

declare global {
    interface EventMap {
        'analysis.created': AnalysisCreatedEventPayload;
        'analysis.deleted': AnalysisDeletedEventPayload;
        'analysis.stage.changed': AnalysisStageChangedEventPayload;
        'analysis.status.changed': AnalysisStatusChangedEventPayload;
    }
}
