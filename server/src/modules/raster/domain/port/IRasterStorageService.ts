/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration). Existing
 * `@modules/raster/domain/port/IRasterStorageService` importers keep working
 * unchanged.
 */
export type { IRasterStorageService } from '@shared/contracts/ports/IRasterStorageService';
