/**
 * Neutral, cross-module DI token symbols for CLUSTER SERVICES that are consumed
 * (injected) outside the cluster module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols let a consumer inject the cluster module's services/repos without
 * importing `@modules/cluster/di/ClusterTokens`. Keys are the
 * SAME `Symbol.for(...)` strings used by the cluster module's `CLUSTER_TOKENS`,
 * so registration and resolution are byte-identical at runtime.
 */
export const CLUSTER_SERVICE_TOKENS = Object.freeze({
    DaemonAnalysisCompletionService: Symbol.for('DaemonAnalysisCompletionService'),
    TeamClusterExposureRegistryService: Symbol.for('TeamClusterExposureRegistryService'),
    TeamClusterRepository: Symbol.for('TeamClusterRepository'),
    StoragePlacementRepository: Symbol.for('StoragePlacementRepository'),
    ClusterTransferJobRepository: Symbol.for('ClusterTransferJobRepository'),
    TeamClusterReverseChannelService: Symbol.for('TeamClusterReverseChannelService')
});
