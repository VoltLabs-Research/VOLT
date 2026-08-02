import type StoragePlacementEntity from '@modules/cluster/models/StoragePlacement';
import type {
    PersistedStoragePlacement,
    StoragePlacementBucketRef,
    StoragePlacementProps,
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
    const deduped = new Map<string, StoragePlacementBucketRef>();

    for(const bucketRef of buckets){
        if(bucketRef.bucket){
            deduped.set(`${bucketRef.bucket}:${bucketRef.prefix}`, {
                bucket: bucketRef.bucket,
                prefix: bucketRef.prefix
            });
        }
    }

    return [...deduped.values()].sort((left, right) => {
        if(left.bucket !== right.bucket){
            return left.bucket.localeCompare(right.bucket);
        }

        return left.prefix.localeCompare(right.prefix);
    });
};

type StoragePlacementPropsInput =
    Partial<StoragePlacementProps>
    & Pick<StoragePlacementProps, 'team' | 'scopeType' | 'scopeId' | 'primaryClusterId' | 'buckets'>;

export const createStoragePlacementProps = (
    input: StoragePlacementPropsInput
): StoragePlacementProps => {
    const now = input.createdAt ?? input.updatedAt ?? new Date();

    return {
        ...input,
        replicaClusterIds: [...new Set((input.replicaClusterIds ?? []).filter(Boolean))],
        buckets: normalizeStoragePlacementBuckets(input.buckets),
        state: input.state ?? DEFAULT_STORAGE_PLACEMENT_STATE,
        lastVerifiedAt: input.lastVerifiedAt ?? null,
        bytesUsed: input.bytesUsed ?? null,
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
