/**
 * Barrel for neutral cross-module event contracts.
 *
 * Exposes the domain event NAME constants and the cross-consumed event PAYLOAD
 * interfaces so a subscriber/consumer needn't import the emitter's
 * `@modules/*` code.
 */
export { DOMAIN_EVENTS } from './event-names';
export type { AnalysisDeletedEventPayload } from './AnalysisDeletedPayload';
export type { TrajectoryDeletedEventPayload } from './TrajectoryDeletedPayload';
export type { TrajectoryUpdatedEventPayload } from './TrajectoryUpdatedPayload';
export type { JobStatusChangedEventPayload } from './JobStatusChangedPayload';
export type { AnalysisStageChangedEventPayload } from './AnalysisStageChangedPayload';
export type { AnalysisStatusChangedEventPayload } from './AnalysisStatusChangedPayload';
export type { AnalysisCreatedEventPayload } from './AnalysisCreatedPayload';
export type { SceneArtifactBatchUpsertedArtifact, SceneArtifactBatchUpsertedEventPayload } from './SceneArtifactBatchUpsertedPayload';
export type { UserActivityRecordedPayload } from './UserActivityRecordedPayload';
