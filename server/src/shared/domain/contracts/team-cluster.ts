/**
 * Storage-placement domain vocabulary shared across modules.
 *
 * These describe how a team's authoritative storage for a scope (trajectory,
 * analysis or plugin binary) is laid out across clusters. They are pure domain
 * concepts (no infrastructure dependency) and therefore live under
 * `shared/domain` so domain-layer files (entities, ports) can reference them
 * without violating the dependency rule.
 */

export type StoragePlacementScopeType = 'trajectory' | 'analysis' | 'plugin-binary';
export type StoragePlacementState = 'active' | 'moving' | 'read-only' | 'deleting';

export interface StoragePlacementBucketRef {
    bucket: string;
    prefix: string;
}

export interface StoragePlacement {
    scopeType: StoragePlacementScopeType;
    scopeId: string;
    primaryClusterId: string;
    replicaClusterIds: string[];
    buckets: StoragePlacementBucketRef[];
    state: StoragePlacementState;
    lastVerifiedAt?: Date | string;
    bytesUsed?: number;
}
