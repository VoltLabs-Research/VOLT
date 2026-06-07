import type {
    StoragePlacement as StoragePlacementContract,
    StoragePlacementBucketRef,
    StoragePlacementScopeType,
    StoragePlacementState
} from '@shared/infrastructure/contracts/team-cluster';

export interface StoragePlacementProps extends Omit<StoragePlacementContract, 'lastVerifiedAt' | 'bytesUsed'> {
    team: string;
    lastVerifiedAt: Date | null;
    bytesUsed: number | null;
    lastAccessedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export const DEFAULT_STORAGE_PLACEMENT_STATE: StoragePlacementState = 'active';

export const normalizeStoragePlacementBuckets = (
    buckets: StoragePlacementBucketRef[]
): StoragePlacementBucketRef[] => {
    return buckets
        .filter((bucketRef) => Boolean(bucketRef.bucket))
        .map((bucketRef) => ({
            bucket: bucketRef.bucket,
            prefix: bucketRef.prefix
        }))
        .sort((left, right) => {
            if (left.bucket !== right.bucket) {
                return left.bucket.localeCompare(right.bucket);
            }

            return left.prefix.localeCompare(right.prefix);
        });
};

export const createStoragePlacementProps = (
    input: {
        team: string;
        scopeType: StoragePlacementScopeType;
        scopeId: string;
        primaryClusterId: string;
        replicaClusterIds?: string[];
        buckets: StoragePlacementBucketRef[];
        state?: StoragePlacementState;
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

export default class StoragePlacement {
    constructor(
        public readonly _id: string,
        public props: StoragePlacementProps
    ) {}

    get id(): string {
        return this._id;
    }
}
