import { createDomainEvent } from '@shared/events/create-domain-event';
import type { Failed } from '@shared/contracts/types/job-identity';
import type { ArtifactUploadJobStatusReport, SceneArtifactUpsertBatch } from '@volt/contracts/modules/cluster/daemon-events';

export type BaseArtifactUploadEventData = Omit<ArtifactUploadJobStatusReport, 'status' | 'error'>;
export type ArtifactUploadFailedEventData = Failed<BaseArtifactUploadEventData>;

export const ArtifactUploadStartedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.started');
export const ArtifactUploadCompletedEvent = createDomainEvent<BaseArtifactUploadEventData>('plugin.artifact-upload.completed');
export const ArtifactUploadFailedEvent = createDomainEvent<ArtifactUploadFailedEventData>('plugin.artifact-upload.failed');
export const SceneArtifactBatchReportedEvent = createDomainEvent<SceneArtifactUpsertBatch>('plugin.scene-artifact-batch-reported');
