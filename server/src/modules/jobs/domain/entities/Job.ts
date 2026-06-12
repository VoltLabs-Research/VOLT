/**
 * The `JobStatus` enum now lives in the neutral contracts layer
 * (`@shared/contracts/types/JobStatus`) for the detachable-modules migration.
 * Re-exported here (as a runtime value) so existing importers of this module
 * path keep compiling and behaving unchanged.
 */
export { JobStatus } from '@shared/contracts/types/JobStatus';
