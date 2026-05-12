import { createDomainEvent } from '@/core/events/createDomainEvent';
import type { Failed, JobIdentity } from '@/support/contracts/job-identity';

export type TimedTrajectoryJobEventData = JobIdentity;

export type RasterFailedEventData = Failed<TimedTrajectoryJobEventData>;
export type GlbFailedEventData = Failed<TimedTrajectoryJobEventData>;

export const RasterStartedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.raster.started');
export const RasterCompletedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.raster.completed');
export const RasterFailedEvent = createDomainEvent<RasterFailedEventData>('trajectory.raster.failed');
export const GlbStartedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.glb.started');
export const GlbCompletedEvent = createDomainEvent<TimedTrajectoryJobEventData>('trajectory.glb.completed');
export const GlbFailedEvent = createDomainEvent<GlbFailedEventData>('trajectory.glb.failed');
