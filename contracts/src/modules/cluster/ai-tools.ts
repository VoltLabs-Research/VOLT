import type { tags } from 'typia';
import type { ClusterTransferJobState, TeamClusterInstallManifestPorts, TeamClusterQueueConcurrency, TeamClusterQueueScopeLimits, TeamClusterRemoteAccessTarget, TeamClusterRole } from './domain';

export interface ClusterRefInput{
    teamClusterId: string;
}

export interface ListClustersInput{
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    search?: string;
}

export interface ListClusterTransferJobsInput{
    teamClusterId: string;
    page?: number & tags.Default<1>;
    limit?: number & tags.Default<50>;
    state?: ClusterTransferJobState;
}

export interface ListRemoteClusterFilesInput{
    teamClusterId: string;
    sessionId: string;
    target: TeamClusterRemoteAccessTarget;
    path: string;
}

export interface UpdateClusterRoleInput{
    teamClusterId: string;
    role: TeamClusterRole;
}

export interface UpdateClusterQueueConcurrencyInput{
    teamClusterId: string;
    queueConcurrency: TeamClusterQueueConcurrency;
    queueScopeLimits: TeamClusterQueueScopeLimits;
}

export interface GenerateClusterInstallManifestInput{
    teamClusterId: string;
    daemonPassword: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPorts;
}

export interface RevealClusterCredentialsInput{
    teamClusterId: string;
    password: string;
}
