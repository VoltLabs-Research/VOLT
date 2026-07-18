/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/cluster/ports/ITeamClusterRepository` importers keep working
 * unchanged.
 */
export type {
    ITeamClusterRepository,
    TeamClusterLifecycleUpdatePreconditions
} from '@shared/contracts/ports/ITeamClusterRepository';
