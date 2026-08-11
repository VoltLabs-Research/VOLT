
import type { TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type {
    TeamClusterRoleCapabilitiesProps,
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

/**
 * What a cluster may actually be asked to do: its role's capabilities, minus
 * whatever it is currently draining. A cluster that is draining storage still
 * serves reads, so residual downloads keep working while it empties.
 */
export const resolveEffectiveCapabilitiesFromRoleConfig = (
    roleConfig: Pick<TeamClusterRuntimeRoleConfigProps, 'effectiveRole' | 'draining'>
): TeamClusterEffectiveCapabilitiesProps => {
    const { canStore, canCompute } = TEAM_CLUSTER_ROLE_CAPABILITIES[roleConfig.effectiveRole];
    const computeDraining = roleConfig.draining?.compute === true;
    const storageDraining = roleConfig.draining?.storage === true;
    const servesResidualStorageReads = canStore || canCompute || storageDraining;

    return {
        acceptsComputeJobs: canCompute && !computeDraining,
        acceptsStorageWrites: canStore && !storageDraining,
        servesStorageReads: servesResidualStorageReads,
        servesArtifactDownloads: servesResidualStorageReads
    };
};
