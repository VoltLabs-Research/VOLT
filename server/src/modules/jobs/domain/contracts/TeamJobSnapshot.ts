/**
 * The canonical definitions now live in the neutral contracts layer
 * (`@shared/contracts/types/TeamJobSnapshot`) for the detachable-modules
 * migration. Re-exported here so existing importers of this module path keep
 * compiling unchanged.
 */
export type { TeamJobSnapshot, TeamJobStatus } from '@shared/contracts/types/TeamJobSnapshot';
