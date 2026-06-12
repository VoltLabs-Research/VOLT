/**
 * Re-export shim. Canonical `DownloadStreamOutputDTO` now lives in the neutral
 * `shared/contracts` layer (detachable-modules migration). Existing
 * `@modules/plugin/domain/contracts/plugin/DownloadStream` importers keep
 * working unchanged.
 */
export type { DownloadStreamOutputDTO } from '@shared/contracts/types/DownloadStream';
