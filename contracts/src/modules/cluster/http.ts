// Wire request bodies the CLIENT sends. Server-derived context (the
// authenticated userId, the `:teamId` / `:teamClusterId` / `:token` path params)
// is NOT here — the controller augments those on its own from the request.

import type {
    TeamClusterRole,
    TeamClusterRemoteAccessTarget,
    TeamClusterInstallManifestPortsWire
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

/** Password-confirmed cluster actions (reveal credentials, delete, remote-access session). */
export interface PasswordConfirmedInput{
    password: string;
}

export type RevealTeamClusterCredentialsInput = PasswordConfirmedInput;

export type DeleteTeamClusterInput = PasswordConfirmedInput;

export interface CreateTeamClusterRemoteAccessSessionInput extends PasswordConfirmedInput{
    target: TeamClusterRemoteAccessTarget;
}

export interface TeamClusterRemoteExplorerRequestInput{
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

export type ListTeamClusterRemoteExplorerEntriesInput = TeamClusterRemoteExplorerRequestInput;
export type GetTeamClusterRemoteExplorerNodeInput = TeamClusterRemoteExplorerRequestInput;
export type DownloadTeamClusterRemoteExplorerObjectInput = TeamClusterRemoteExplorerRequestInput;

// --- Daemon-facing (unauthenticated / daemon-authenticated) bodies -----------

export interface ProcessTeamClusterHealthcheckInput{
    enrollmentToken: string;
    installedVersion?: string;
}

export interface GenerateTeamClusterInstallManifestInput{
    daemonPassword: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPortsWire;
}
