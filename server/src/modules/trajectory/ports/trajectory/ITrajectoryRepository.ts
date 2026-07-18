/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/ITrajectoryRepository`) for the detachable-modules
 * migration. Re-exported here so existing importers of this module path keep
 * compiling unchanged.
 */
export type { ITrajectoryRepository } from '@shared/contracts/ports/ITrajectoryRepository';
