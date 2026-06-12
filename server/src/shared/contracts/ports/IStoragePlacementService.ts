/**
 * Neutral, cross-module port for the storage-placement service (resolves which
 * cluster owns/replicates a trajectory's / analysis's / plugin-binary's bytes).
 *
 * Extracted from `@modules/cluster/domain/port/IStoragePlacementService` during
 * the detachable-modules migration. The concrete `StoragePlacementService`
 * stays in the cluster module, registered under
 * `COMPUTE_TOKENS.StoragePlacementService` so consumers (trajectory, plugin,
 * cluster) can `@inject(COMPUTE_TOKENS.StoragePlacementService)` against this
 * port without importing `@modules/cluster`. The original port file re-exports
 * this so existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the return type `StoragePlacement`
 * is an entity CLASS (with `props` + an `id` getter) that has not been extracted
 * into a neutral structural contract yet, so it is imported here with
 * `import type` only (erased by tsc — no runtime/decorator coupling). The scope
 * and state unions already live in the neutral `@shared/domain/contracts`
 * layer. Replacing the class with a structural `StoragePlacement` contract is
 * deferred.
 */
import type StoragePlacement from '@modules/cluster/domain/entities/StoragePlacement';
import type {
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/domain/contracts/team-cluster';

export interface IStoragePlacementService {
    findByScope(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement | null>;
    ensurePlacement(
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<StoragePlacement>;
    assignPluginBinaryPlacement(
        pluginId: string,
        team: string,
        primaryClusterId: string
    ): Promise<StoragePlacement>;
    switchPrimaryCluster(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        primaryClusterId: string,
        options?: {
            replicaClusterIds?: string[];
            state?: StoragePlacementState;
            lastVerifiedAt?: Date | null;
            bytesUsed?: number | null;
            lastAccessedAt?: Date | null;
        }
    ): Promise<StoragePlacement>;
    setPlacementState(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        state: StoragePlacementState
    ): Promise<StoragePlacement>;
    synchronizeScopeStorageOwner(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        storageClusterId: string
    ): Promise<void>;
    listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>;
    resolveTransferPlacementsForCluster(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]>;
}
