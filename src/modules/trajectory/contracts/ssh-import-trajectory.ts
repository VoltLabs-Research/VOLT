interface SshImportTrajectoryContext {
    teamId: string;
    trajectoryId: string;
    userId: string;
}

interface AuthenticatedTrajectoryImportContext extends SshImportTrajectoryContext {
    teamClusterId: string;
    daemonPassword: string;
}

export interface SSHImportJobPayload extends SshImportTrajectoryContext {
    jobId: string;
    sshConnectionId: string;
    remotePath: string;
    host: string;
    port?: number;
    username: string;
    encryptedPassword: string;
}

export interface SshImportFramePayload {
    timestep: number;
    natoms: number;
    simulationCell: any;
    size: number;
}

export interface CompletedTrajectoryImportPayload extends AuthenticatedTrajectoryImportContext {
    success: true;
    frames: SshImportFramePayload[];
}

export interface FailedTrajectoryImportPayload extends AuthenticatedTrajectoryImportContext {
    success: false;
    failureCode: 'SSH::Import::Error';
    failureDetails: string;
}

export type TrajectoryImportPayload = CompletedTrajectoryImportPayload | FailedTrajectoryImportPayload;
