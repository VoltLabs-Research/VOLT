/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/cluster/domain/port/ITeamClusterObjectGatewayClient` importers
 * keep working unchanged.
 */
export type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports/ITeamClusterObjectGatewayClient';
