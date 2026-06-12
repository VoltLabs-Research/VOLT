/**
 * Re-export shim. Canonical port now lives in the neutral `shared/contracts`
 * layer (detachable-modules migration).
 */
export type {
    ClusterArchiveObjectEntry,
    ClusterArchiveInlineEntry,
    ClusterArchiveEntry,
    ClusterArchiveReference,
    ClusterArchiveDownload,
    CreateArchiveDownloadInput,
    IClusterObjectArchiveService
} from '@shared/contracts/ports/IClusterObjectArchiveService';
