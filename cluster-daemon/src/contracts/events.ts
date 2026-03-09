export enum RuntimeLifecycleEventType {
    Starting = 'starting',
    ServicesReady = 'services-ready',
    HeartbeatSucceeded = 'heartbeat-succeeded',
    HeartbeatFailed = 'heartbeat-failed',
    CloudSocketConnected = 'cloud-socket-connected',
    CloudSocketDisconnected = 'cloud-socket-disconnected',
    UninstallRequested = 'uninstall-requested',
    UninstallCompleted = 'uninstall-completed',
    UninstallFailed = 'uninstall-failed'
};

export enum ProgressStage {
    Accepted = 'accepted',
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed'
};

export enum RuntimeEventName {
    Lifecycle = 'lifecycle',
    Progress = 'progress'
};

export interface RuntimeLifecycleEvent {
    type: RuntimeLifecycleEventType;
    teamClusterId: string;
    timestamp: string;
    connectedToCloud: boolean;
    details?: string;
};

export interface RuntimeProgressEvent {
    action: string;
    stage: ProgressStage;
    timestamp: string;
    details?: string;
    payload?: Record<string, unknown>;
};
