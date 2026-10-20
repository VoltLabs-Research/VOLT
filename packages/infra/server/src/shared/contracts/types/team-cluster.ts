

export type { StoragePlacementScopeType } from '@volt/contracts/modules/cluster/domain';
import type { StoragePlacementScopeType } from '@volt/contracts/modules/cluster/domain';
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

export interface StoragePlacementProps extends Omit<StoragePlacement, 'lastVerifiedAt' | 'bytesUsed'> {
    team: string;
    lastVerifiedAt: Date | null;
    bytesUsed: number | null;
    lastAccessedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface PersistedStoragePlacement {
    readonly _id: string;
    props: StoragePlacementProps;
}
