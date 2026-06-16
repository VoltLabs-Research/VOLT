/**
 * Pure, cross-module TeamCluster capability resolution. Canonical home in the
 * neutral `shared/domain` layer (detachable-modules migration) so consumers
 * (the cluster domain entity, the container module's role-aware selection
 * service) can derive a cluster's effective capabilities from its role config
 * without importing `@modules/cluster`.
 *
 * These are pure functions over the neutral role-config data shapes
 * (`@shared/contracts/types/TeamCluster`) — no entity class, no module coupling.
 * Living in `shared/domain` keeps the cluster domain entity's import of them
 * inward-pointing (domain → domain), not domain → application.
 */
import type {
    TeamClusterRole,
    TeamClusterRoleCapabilitiesProps,
    TeamClusterRoleDrainProps,
    TeamClusterRuntimeRoleConfigProps,
    TeamClusterEffectiveCapabilitiesProps
} from '@shared/contracts/types/TeamCluster';

const TEAM_CLUSTER_ROLE_CAPABILITIES: Record<TeamClusterRole, TeamClusterRoleCapabilitiesProps> = {
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
): TeamClusterRoleCapabilitiesProps => {
    return { ...TEAM_CLUSTER_ROLE_CAPABILITIES[role] };
};

export const buildTeamClusterEffectiveCapabilities = (
    role: TeamClusterRole,
    draining: Partial<TeamClusterRoleDrainProps> = {}
): TeamClusterEffectiveCapabilitiesProps => {
    const capabilities = resolveTeamClusterRoleCapabilities(role);
    const computeDraining = draining.compute === true;
    const storageDraining = draining.storage === true;
    const servesResidualStorageReads = capabilities.canStore || capabilities.canCompute || storageDraining;

    return {
        acceptsComputeJobs: capabilities.canCompute && !computeDraining,
        acceptsStorageWrites: capabilities.canStore && !storageDraining,
        servesStorageReads: servesResidualStorageReads,
        servesArtifactDownloads: servesResidualStorageReads
    };
};

export const resolveEffectiveCapabilitiesFromRoleConfig = (
    roleConfig: Pick<TeamClusterRuntimeRoleConfigProps, 'effectiveRole' | 'draining'>
): TeamClusterEffectiveCapabilitiesProps => {
    return buildTeamClusterEffectiveCapabilities(
        roleConfig.effectiveRole,
        roleConfig.draining
    );
};
