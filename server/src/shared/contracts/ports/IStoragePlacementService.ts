
import type { StoragePlacement } from '@modules/cluster/contracts/domain/storage-placement';
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
