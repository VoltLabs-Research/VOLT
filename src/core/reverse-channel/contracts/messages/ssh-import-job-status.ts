import type { SshImportCompletedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportCompletedEvent';
import type { SshImportFailedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportFailedEvent';
import type { SshImportStartedEventData } from '@/modules/trajectory/domain/events/ssh-import/SshImportStartedEvent';

export interface AuthenticatedMessageContext {
    daemonPassword: string;
    teamClusterId: string;
}

type SshImportJobStatusPayload = SshImportStartedEventData | SshImportCompletedEventData | SshImportFailedEventData;

export interface SshImportJobStatusMessage extends AuthenticatedMessageContext {
    error?: string;
    jobId: string;
    status: 'running' | 'completed' | 'failed';
    teamId: string;
    trajectoryId: string;
    trajectoryName?: string;
    type: 'ssh-import-job-status';
}

export const createSshImportJobStatusMessage = (
    context: AuthenticatedMessageContext,
    payload: SshImportJobStatusPayload,
    status: SshImportJobStatusMessage['status']
): SshImportJobStatusMessage => ({
    type: 'ssh-import-job-status',
    status,
    ...context,
    ...payload,
    ...('error' in payload ? { error: payload.error } : {})
});

export const createSshImportJobStatusDedupeKey = (
    payload: SshImportJobStatusPayload,
    status: SshImportJobStatusMessage['status']
): string => {
    return `ssh-import.job-status:${payload.jobId}:${status}`;
};
