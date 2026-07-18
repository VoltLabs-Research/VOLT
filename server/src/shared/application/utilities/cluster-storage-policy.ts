/**
 * Pure, cross-module storage-policy thresholds (percent-of-capacity knobs that
 * drive cluster storage assignment + rebalancing). Canonical home in the neutral
 * `shared` layer (detachable-modules migration) so the container module's
 * selection service needn't import `@modules/cluster` for them. Plain numeric
 * constants — no module coupling.
 *
 * The original `@modules/cluster/services/cluster-storage-policy`
 * re-exports these for backward compatibility.
 */
export const SOFT_STORAGE_LIMIT_PCT = 85;
export const HARD_STORAGE_LIMIT_PCT = 92;
export const REBALANCE_TARGET_PCT = 70;
export const SOFT_STORAGE_ASSIGNMENT_PENALTY = 25;
