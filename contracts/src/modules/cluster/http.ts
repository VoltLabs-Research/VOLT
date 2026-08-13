

import type {
    TeamClusterRole,
    TeamClusterRemoteAccessTarget,
    TeamClusterInstallManifestPorts
} from './domain';

export interface CreateTeamClusterInput{
    name: string;
}

export interface UpdateTeamClusterRoleInput{
    role: TeamClusterRole;
}

export interface TeamClusterQueueConcurrencyInput{
    analysis: number;
    rasterizer: number;
    glbPreprocessing: number;
    artifactUpload: number;
    pluginWarmup: number;
}

export interface TeamClusterQueueScopeLimitInput{
    maxRunningPerTrajectory: number;
}

export interface UpdateTeamClusterQueueConcurrencyInput{
    queueConcurrency: TeamClusterQueueConcurrencyInput;
    queueScopeLimits: {
        analysisProcessing: TeamClusterQueueScopeLimitInput;
        artifactUpload: TeamClusterQueueScopeLimitInput;
        trajectoryRasterization: TeamClusterQueueScopeLimitInput;
        trajectoryGlbConversion: TeamClusterQueueScopeLimitInput;
    };
}

export interface CreateTeamClusterTransferRequestInput{
    destinationClusterId: string;
}

export interface PasswordConfirmedInput{
    password: string;
}

export type DeleteTeamClusterInput = PasswordConfirmedInput;

export interface CreateTeamClusterRemoteAccessSessionInput extends PasswordConfirmedInput{
    target: TeamClusterRemoteAccessTarget;
}

export interface ProcessTeamClusterHealthcheckInput{
    enrollmentToken: string;
    installedVersion?: string;
}

export interface GenerateTeamClusterInstallManifestInput{
    daemonPassword: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPorts;
}
