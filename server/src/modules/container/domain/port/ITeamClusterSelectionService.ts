/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/container/domain/port/ITeamClusterSelectionService` importers keep
 * working unchanged.
 */
export type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
