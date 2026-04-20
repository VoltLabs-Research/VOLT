import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { Failed, JobIdentity } from '@/support/contracts/job-identity';

export type TrajectoryJobEventData = JobIdentity;
export type TimedTrajectoryJobEventData = JobIdentity;

export type RasterFailedEventData = Failed<TimedTrajectoryJobEventData>;
export type GlbFailedEventData = Failed<TimedTrajectoryJobEventData>;
export type SshImportFailedEventData = Failed<TrajectoryJobEventData>;

export const RasterStartedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.raster.started');
export const RasterCompletedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.raster.completed');
export const RasterFailedEvent = createDomainEvent<RasterFailedEventData>('trajectory.raster.failed');
export const GlbStartedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.glb.started');
export const GlbCompletedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.glb.completed');
export const GlbFailedEvent = createDomainEvent<GlbFailedEventData>('trajectory.glb.failed');
export const SshImportStartedEvent = createDomainEvent<TrajectoryJobEventData>('trajectory.ssh-import.started');
export const SshImportCompletedEvent = createDomainEvent<TrajectoryJobEventData>('trajectory.ssh-import.completed');
export const SshImportFailedEvent = createDomainEvent<SshImportFailedEventData>('trajectory.ssh-import.failed');
