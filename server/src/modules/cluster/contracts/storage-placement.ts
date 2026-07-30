import type StoragePlacementEntity from '@modules/cluster/models/StoragePlacement';
import type {
    PersistedStoragePlacement,
    StoragePlacementBucketRef,
    StoragePlacementProps,
    StoragePlacementScopeType as StoragePlacementScopeTypeContract,
    StoragePlacementState as StoragePlacementStateContract
} from '@shared/domain/contracts/team-cluster';

export type { PersistedStoragePlacement as StoragePlacement, StoragePlacementProps };

export enum StoragePlacementScopeType {
    Trajectory = 'trajectory',
    Analysis = 'analysis',
    PluginBinary = 'plugin-binary'
}

export enum StoragePlacementState {
    Active = 'active',
    Moving = 'moving',
    ReadOnly = 'read-only',
    Deleting = 'deleting'
}

export const DEFAULT_STORAGE_PLACEMENT_STATE: StoragePlacementStateContract = StoragePlacementState.Active;

const normalizeStoragePlacementBuckets = (
    buckets: StoragePlacementBucketRef[]
): StoragePlacementBucketRef[] => {
    return buckets
        .filter((bucketRef) => Boolean(bucketRef.bucket))
        .map((bucketRef) => ({
            bucket: bucketRef.bucket,
            prefix: bucketRef.prefix
        }))
        .sort((left, right) => {
            if(left.bucket !== right.bucket){
                return left.bucket.localeCompare(right.bucket);
            }

            return left.prefix.localeCompare(right.prefix);
        });
};

export const createStoragePlacementProps = (
    input: {
        team: string;
        scopeType: StoragePlacementScopeTypeContract;
        scopeId: string;
        primaryClusterId: string;
        replicaClusterIds?: string[];
        buckets: StoragePlacementBucketRef[];
        state?: StoragePlacementStateContract;
        lastVerifiedAt?: Date | null;
        bytesUsed?: number | null;
        lastAccessedAt?: Date | null;
        createdAt?: Date;
        updatedAt?: Date;
    }
): StoragePlacementProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();

    return {
        team: input.team,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        primaryClusterId: input.primaryClusterId,
        replicaClusterIds: [...new Set((input.replicaClusterIds ?? []).filter(Boolean))],
        buckets: normalizeStoragePlacementBuckets(input.buckets),
        state: input.state ?? DEFAULT_STORAGE_PLACEMENT_STATE,
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        bytesUsed: typeof input.bytesUsed === 'number' ? input.bytesUsed : null,
        lastAccessedAt: input.lastAccessedAt ?? null,
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now
    };
};

export const toStoragePlacementLike = (entity: StoragePlacementEntity): PersistedStoragePlacement => ({
    _id: entity.id,
    props: {
        team: entity.team,
        scopeType: entity.scopeType,
        scopeId: entity.scopeId,
        primaryClusterId: entity.primaryClusterId,
        replicaClusterIds: entity.replicaClusterIds ?? [],
        buckets: entity.buckets,
        state: entity.state,
        lastVerifiedAt: entity.lastVerifiedAt,
        bytesUsed: entity.bytesUsed,
        lastAccessedAt: entity.lastAccessedAt,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
    }
});
