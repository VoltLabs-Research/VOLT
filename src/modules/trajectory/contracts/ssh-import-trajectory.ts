import type { JobIdentity } from '@/support/contracts/job-identity';
import type { ParsedSimulationCell } from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';

export interface SSHImportJobPayload extends JobIdentity {
    trajectoryId: string;
    userId: string;
    host: string;
    port?: number;
    username: string;
    encryptedPassword: string;
    remotePath: string;
}

interface BaseTrajectoryImportPayload {
    teamClusterId: string;
    daemonPassword: string;
    trajectoryId: string;
    teamId: string;
    userId: string;
}

export interface CompletedTrajectoryImportFrame {
    timestep: number;
    natoms: number;
    simulationCell: ParsedSimulationCell;
    size: number;
}

export interface CompletedTrajectoryImportPayload extends BaseTrajectoryImportPayload {
    success: true;
    frames: CompletedTrajectoryImportFrame[];
}

export interface FailedTrajectoryImportPayload extends BaseTrajectoryImportPayload {
    success: false;
    failureCode: string;
    failureDetails: string;
}

export type TrajectoryImportPayload = CompletedTrajectoryImportPayload | FailedTrajectoryImportPayload;
