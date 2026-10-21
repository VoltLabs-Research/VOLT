import type {
    DaemonIdentity,
    DaemonJobStatus,
    GlbJobStatusEvent,
    RasterJobStatusEvent,
    TrajectoryJobStatusReport
} from '@volt/contracts/modules/cluster/daemon-events';

type TrajectoryJobStatusPayload = Omit<TrajectoryJobStatusReport, 'status'>;

const toStatusReport = (payload: TrajectoryJobStatusPayload, status: DaemonJobStatus): TrajectoryJobStatusReport => ({
    jobId: payload.jobId,
    teamId: payload.teamId,
    trajectoryId: payload.trajectoryId,
    ...(payload.timestep !== undefined ? { timestep: payload.timestep } : {}),
    ...(payload.error !== undefined ? { error: payload.error } : {}),
    status
});

export const createRasterJobStatusMessage = (
    context: DaemonIdentity,
    payload: TrajectoryJobStatusPayload,
    status: DaemonJobStatus
): RasterJobStatusEvent => ({
    type: 'trajectory-raster-job-status',
    ...context,
    ...toStatusReport(payload, status)
});

export const createGlbJobStatusMessage = (
    context: DaemonIdentity,
    payload: TrajectoryJobStatusPayload,
    status: DaemonJobStatus
): GlbJobStatusEvent => ({
    type: 'trajectory-glb-job-status',
    ...context,
    ...toStatusReport(payload, status)
});

export const createRasterJobStatusDedupeKey = (
    payload: Pick<TrajectoryJobStatusReport, 'jobId' | 'timestep'>,
    status: DaemonJobStatus
): string =>
    `trajectory.raster-job-status:${payload.jobId}:${status}:${payload.timestep ?? 'none'}`;

export const createGlbJobStatusDedupeKey = (
    payload: Pick<TrajectoryJobStatusReport, 'jobId' | 'timestep'>,
    status: DaemonJobStatus
): string =>
    `trajectory.glb-job-status:${payload.jobId}:${status}:${payload.timestep ?? 'none'}`;
