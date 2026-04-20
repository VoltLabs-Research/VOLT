import {
    readTimestepDedupeSegment,
    type AuthenticatedMessageContext,
    type AuthenticatedReverseChannelMessage
} from '@/core/reverse-channel/contracts/reverse-channel-messaging';
import type {
    GlbFailedEventData,
    RasterFailedEventData,
    SshImportFailedEventData,
    TimedTrajectoryJobEventData,
    TrajectoryJobEventData
} from '@/modules/trajectory/domain/events';

type TimedTrajectoryStatus = 'running' | 'completed' | 'failed';
type TrajectoryStatus = 'running' | 'completed' | 'failed';

type TimedTrajectoryJobStatusPayload = TimedTrajectoryJobEventData | RasterFailedEventData | GlbFailedEventData;
type TrajectoryJobStatusPayload = TrajectoryJobEventData | SshImportFailedEventData;

const mergeError = (payload: object): { error?: string } =>
    'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
        ? { error: (payload as { error: string }).error }
        : {};

export type RasterJobStatusMessage = AuthenticatedReverseChannelMessage<
    'trajectory-raster-job-status',
    TimedTrajectoryJobEventData & { status: TimedTrajectoryStatus; error?: string }
>;

export type GlbJobStatusMessage = AuthenticatedReverseChannelMessage<
    'trajectory-glb-job-status',
    TimedTrajectoryJobEventData & { status: TimedTrajectoryStatus; error?: string }
>;

export type SshImportJobStatusMessage = AuthenticatedReverseChannelMessage<
    'ssh-import-job-status',
    TrajectoryJobEventData & { status: TrajectoryStatus; error?: string }
>;

const pickJobIdentity = <T extends TimedTrajectoryJobStatusPayload | TrajectoryJobStatusPayload>(payload: T) => ({
    jobId: payload.jobId,
    teamId: payload.teamId,
    trajectoryId: payload.trajectoryId,
    ...('timestep' in payload ? { timestep: (payload as { timestep?: number }).timestep } : {})
});

export const createRasterJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: TimedTrajectoryJobStatusPayload,
    status: TimedTrajectoryStatus
): RasterJobStatusMessage => ({
    type: 'trajectory-raster-job-status',
    ...context,
    ...pickJobIdentity(payload),
    ...mergeError(payload),
    status
});

export const createGlbJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: TimedTrajectoryJobStatusPayload,
    status: TimedTrajectoryStatus
): GlbJobStatusMessage => ({
    type: 'trajectory-glb-job-status',
    ...context,
    ...pickJobIdentity(payload),
    ...mergeError(payload),
    status
});

export const createSshImportJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: TrajectoryJobStatusPayload,
    status: TrajectoryStatus
): SshImportJobStatusMessage => ({
    type: 'ssh-import-job-status',
    ...context,
    ...pickJobIdentity(payload),
    ...mergeError(payload),
    status
});

export const createRasterJobStatusDedupeKey = (
    payload: Pick<TimedTrajectoryJobEventData, 'jobId' | 'timestep'>,
    status: TimedTrajectoryStatus
): string =>
    `trajectory.raster-job-status:${payload.jobId}:${status}:${readTimestepDedupeSegment(payload.timestep)}`;

export const createGlbJobStatusDedupeKey = (
    payload: Pick<TimedTrajectoryJobEventData, 'jobId' | 'timestep'>,
    status: TimedTrajectoryStatus
): string =>
    `trajectory.glb-job-status:${payload.jobId}:${status}:${readTimestepDedupeSegment(payload.timestep)}`;

export const createSshImportJobStatusDedupeKey = (
    payload: Pick<TrajectoryJobEventData, 'jobId'>,
    status: TrajectoryStatus
): string => `ssh-import.job-status:${payload.jobId}:${status}`;
