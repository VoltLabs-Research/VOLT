import type {
    AuthenticatedMessageContext,
    AuthenticatedReverseChannelMessage
} from '@/core/reverse-channel/contracts/authenticated';
import { readTimestepDedupeSegment } from '@/core/reverse-channel/contracts/reverse-channel-dedupe';
import type { GlbFailedEventData } from '@/modules/trajectory/domain/events/glb/GlbFailedEvent';
import type { GlbStartedEventData } from '@/modules/trajectory/domain/events/glb/GlbStartedEvent';
import type { RasterFailedEventData } from '@/modules/trajectory/domain/events/raster/RasterFailedEvent';
import type { RasterStartedEventData } from '@/modules/trajectory/domain/events/raster/RasterStartedEvent';
import type { SshImportFailedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent';
import type { SshImportStartedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

type TrajectoryJobStatus = 'running' | 'completed' | 'failed';
type GlbJobStatusPayload = GlbStartedEventData | GlbFailedEventData;
type RasterJobStatusPayload = RasterStartedEventData | RasterFailedEventData;
type SshImportJobStatusPayload = SshImportStartedEventData | SshImportFailedEventData;

type TrajectoryJobStatusMessage<TType extends string, TPayload extends object> = AuthenticatedReverseChannelMessage<
    TType,
    TPayload & { status: TrajectoryJobStatus; error?: string }
>;

export type GlbJobStatusMessage = TrajectoryJobStatusMessage<'trajectory-glb-job-status', GlbStartedEventData>;
export type RasterJobStatusMessage = TrajectoryJobStatusMessage<'trajectory-raster-job-status', RasterStartedEventData>;
export type SshImportJobStatusMessage = TrajectoryJobStatusMessage<'ssh-import-job-status', SshImportStartedEventData>;

const createTrajectoryJobStatusMessage = <TType extends string, TPayload extends object>(
    type: TType,
    context: AuthenticatedMessageContext,
    payload: TPayload,
    status: TrajectoryJobStatus
): TrajectoryJobStatusMessage<TType, TPayload> => {
    const error = 'error' in payload && typeof payload.error === 'string'
        ? { error: payload.error }
        : {};

    return {
        type,
        status,
        ...context,
        ...payload,
        ...error
    };
};

export const createGlbJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: GlbJobStatusPayload,
    status: GlbJobStatusMessage['status']
): GlbJobStatusMessage => createTrajectoryJobStatusMessage('trajectory-glb-job-status', context, payload, status);

export const createGlbJobStatusDedupeKey = (
    payload: Pick<GlbStartedEventData, 'jobId' | 'timestep'>,
    status: GlbJobStatusMessage['status']
): string => {
    return `trajectory.glb-job-status:${payload.jobId}:${status}:${readTimestepDedupeSegment(payload.timestep)}`;
};

export const createRasterJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: RasterJobStatusPayload,
    status: RasterJobStatusMessage['status']
): RasterJobStatusMessage => createTrajectoryJobStatusMessage('trajectory-raster-job-status', context, payload, status);

export const createRasterJobStatusDedupeKey = (
    payload: Pick<RasterStartedEventData, 'jobId' | 'timestep'>,
    status: RasterJobStatusMessage['status']
): string => {
    return `trajectory.raster-job-status:${payload.jobId}:${status}:${readTimestepDedupeSegment(payload.timestep)}`;
};

export const createSshImportJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: SshImportJobStatusPayload,
    status: SshImportJobStatusMessage['status']
): SshImportJobStatusMessage => createTrajectoryJobStatusMessage('ssh-import-job-status', context, payload, status);

export const createSshImportJobStatusDedupeKey = (
    payload: Pick<SshImportStartedEventData, 'jobId'>,
    status: SshImportJobStatusMessage['status']
): string => {
    return `ssh-import.job-status:${payload.jobId}:${status}`;
};
