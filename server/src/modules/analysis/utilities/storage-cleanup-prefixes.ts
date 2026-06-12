/**
 * MOVED to the neutral shared layer (detachable-modules migration).
 * Canonical home: `@shared/application/utilities/storage-cleanup-prefixes`.
 * Re-exported here so existing in-module importers compile unchanged.
 */
export type { AnalysisStorageCleanupTarget } from '@shared/application/utilities/storage-cleanup-prefixes';
export { getAnalysisStorageCleanupTargets } from '@shared/application/utilities/storage-cleanup-prefixes';
