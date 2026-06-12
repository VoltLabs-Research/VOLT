/**
 * Re-export shim. Canonical storage-policy constants now live in the neutral
 * `shared` layer (detachable-modules migration). Existing
 * `@modules/cluster/application/services/cluster-storage-policy` importers keep
 * working unchanged.
 */
export {
    SOFT_STORAGE_LIMIT_PCT,
    HARD_STORAGE_LIMIT_PCT,
    REBALANCE_TARGET_PCT,
    SOFT_STORAGE_ASSIGNMENT_PENALTY
} from '@shared/application/utilities/cluster-storage-policy';
