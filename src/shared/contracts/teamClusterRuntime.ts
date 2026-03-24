export const TEAM_CLUSTER_RUNTIME_CONTRACT_VERSION = 1;

export type TeamClusterRole = 'cluster' | 'storage-server' | 'compute-node';

export interface TeamClusterRoleDrainState {
    compute: boolean;
    storage: boolean;
}

export interface TeamClusterRoleCapabilities {
    canStore: boolean;
    canCompute: boolean;
}

export interface TeamClusterRuntimeRoleConfig {
    desiredRole: TeamClusterRole;
    effectiveRole: TeamClusterRole;
    runtimeVersion: number;
    draining: TeamClusterRoleDrainState;
    lastAppliedAt?: string | Date | null;
}

export interface TeamClusterEffectiveCapabilities {
    acceptsComputeJobs: boolean;
    acceptsStorageWrites: boolean;
    servesStorageReads: boolean;
    servesArtifactDownloads: boolean;
}

const TEAM_CLUSTER_ROLE_CAPABILITIES: Record<TeamClusterRole, TeamClusterRoleCapabilities> = {
    cluster: {
        canStore: true,
        canCompute: true
    },
    'storage-server': {
        canStore: true,
        canCompute: false
    },
    'compute-node': {
        canStore: false,
        canCompute: true
    }
};

export const resolveTeamClusterRoleCapabilities = (
    role: TeamClusterRole
): TeamClusterRoleCapabilities => {
    return { ...TEAM_CLUSTER_ROLE_CAPABILITIES[role] };
};

export const buildTeamClusterEffectiveCapabilities = (
    role: TeamClusterRole,
    draining: Partial<TeamClusterRoleDrainState> = {}
): TeamClusterEffectiveCapabilities => {
    const capabilities = resolveTeamClusterRoleCapabilities(role);
    const computeDraining = draining.compute === true;
    const storageDraining = draining.storage === true;
    const servesResidualStorageReads = capabilities.canStore || capabilities.canCompute || storageDraining;

    return {
        acceptsComputeJobs: capabilities.canCompute && !computeDraining,
        acceptsStorageWrites: capabilities.canStore && !storageDraining,
        // Compute nodes keep read access so previously-owned storage can still
        // be listed and transferred out after a role downgrade.
        servesStorageReads: servesResidualStorageReads,
        servesArtifactDownloads: servesResidualStorageReads
    };
};

export const createDefaultTeamClusterRuntimeRoleConfig = (
    role: TeamClusterRole = 'cluster'
): TeamClusterRuntimeRoleConfig => {
    return {
        desiredRole: role,
        effectiveRole: role,
        runtimeVersion: 1,
        draining: {
            compute: false,
            storage: false
        },
        lastAppliedAt: null
    };
};

export interface TeamClusterDaemonRoleApplyPayload {
    [key: string]: unknown;
    roleConfig: TeamClusterRuntimeRoleConfig;
}

export interface TeamClusterDaemonRoleApplyResult {
    accepted: boolean;
    roleConfig: TeamClusterRuntimeRoleConfig;
    effectiveCapabilities: TeamClusterEffectiveCapabilities;
}
