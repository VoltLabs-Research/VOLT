/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/cluster/domain/port/IStoragePlacementRepository` importers keep
 * working unchanged.
 */
export type { IStoragePlacementRepository } from '@shared/contracts/ports/IStoragePlacementRepository';
