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
    /**
     * An active remote-access session id, obtained after password confirmation for the chosen storage target.
     */
    sessionId: string;
    /**
     * The remote storage target to browse: object-store or daemon-tables.
     */
    target: TeamClusterRemoteAccessTarget;
    /**
     * The path within the target to list. Use an empty string for the root.
     */
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
    /**
     * The id of the cluster the manifest enrolls.
     */
    teamClusterId: string;
    /**
     * The daemon password to embed in the generated manifest.
     */
    daemonPassword: string;
    /**
     * Absolute filesystem path on the target machine where the cluster stack is installed.
     */
    installRoot: string;
    /**
     * Host ports to bind each cluster service to.
     */
    ports: TeamClusterInstallManifestPorts;
}

export interface RevealClusterCredentialsInput{
    teamClusterId: string;
    /**
     * The requesting user's account password, required to confirm the sensitive reveal operation.
     */
    password: string;
}

export interface ManageDemoClusterInput{
    action: 'provision' | 'status' | 'delete';
}
