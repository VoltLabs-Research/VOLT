
import type {
    TeamClusterRole,
    TeamClusterEffectiveCapabilities,
    TeamClusterRuntimeRoleConfig
} from '@volt/contracts/modules/cluster/domain';
import type { TeamClusterRoleCapabilitiesProps } from '@shared/contracts/types/TeamCluster';

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

export const resolveEffectiveCapabilitiesFromRoleConfig = (
    roleConfig: Pick<TeamClusterRuntimeRoleConfig, 'effectiveRole' | 'draining'>
): TeamClusterEffectiveCapabilities => {
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
