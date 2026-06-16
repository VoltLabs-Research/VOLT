/**
 * Neutral, cross-module DI token symbols for CLUSTER-ACCESS clients.
 *
 * Part of the `shared/contracts` layer (see ECOSYSTEM "VOLT Apps" migration):
 * these clients (`TeamClusterDaemonClient`, `TeamClusterObjectGatewayClient`)
 * are consumed by more than one module today, so their tokens live here so that
 * no module has to `import` from `@modules/<other>` to obtain a token. These are
 * plain `Symbol.for(...)` registrations — type-erased at runtime, safe to import
 * from anywhere without pulling in a module's code.
 */
export const CLUSTER_ACCESS_TOKENS = Object.freeze({
    TeamClusterDaemonClient: Symbol.for('TeamClusterDaemonClient'),
    TeamClusterObjectGatewayClient: Symbol.for('TeamClusterObjectGatewayClient'),
    ClusterObjectArchiveService: Symbol.for('ClusterObjectArchiveService'),
    ClusterObjectSignedUrlService: Symbol.for('ClusterObjectSignedUrlService'),
    TeamClusterSelectionService: Symbol.for('TeamClusterSelectionService')
});
