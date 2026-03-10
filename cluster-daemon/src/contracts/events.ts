export enum EventType {
    RuntimeLifecycle = 'lifecycle',
    RuntimeProgress = 'progress',
    TeamClusterDaemonRegister = 'team-cluster-daemon:register',
    TeamClusterDaemonRegistered = 'team-cluster-daemon:registered',
    TeamClusterDaemonMessage = 'team-cluster-daemon:message'
}

export type RuntimeLifecycleEventType =
    | 'starting'
    | 'services-ready'
    | 'heartbeat-succeeded'
    | 'heartbeat-failed'
    | 'cloud-socket-connected'
    | 'cloud-socket-disconnected'
    | 'uninstall-requested'
    | 'uninstall-completed'
    | 'uninstall-failed';

export enum ProgressStageType {
    Accepted = 'accepted',
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
}

export interface RuntimeLifecycleEvent {
    type: RuntimeLifecycleEventType;
    teamClusterId: string;
    timestamp: string;
    connectedToCloud: boolean;
    details?: string;
}

export interface RuntimeProgressEvent {
    action: string;
    stage: ProgressStageType;
    timestamp: string;
    details?: string;
    payload?: Record<string, unknown>;
}
