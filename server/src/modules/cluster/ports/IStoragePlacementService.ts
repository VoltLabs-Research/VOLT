/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/cluster/ports/IStoragePlacementService` importers keep working
 * unchanged.
 */
export type { IStoragePlacementService } from '@shared/contracts/ports/IStoragePlacementService';
