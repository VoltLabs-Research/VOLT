/**
 * Neutral, cross-module port for the team-cluster exposure registry — the
 * in-memory snapshot of service exposures a connected daemon publishes for
 * tunneling. Scoped to the read surface consumed OUTSIDE the cluster module:
 * the scripting module resolves a notebook's runtime container by listing the
 * cluster's current exposures.
 *
 * Extracted during the detachable-modules migration so the scripting module can
 * stop importing the concrete `@modules/cluster` service. The concrete service
 * stays in the cluster module, registered under
 * `CLUSTER_SERVICE_TOKENS.TeamClusterExposureRegistryService`; consumers
 * `@inject(...)` against this port without importing `@modules/cluster`.
 *
 * The richer cluster-internal surface (replace/clear/get/find/listActiveTcp/
 * onChanged/offChanged) lives on
 * `@modules/cluster/domain/port/ITeamClusterExposureRegistryService` and is
 * intentionally NOT mirrored here — this port exposes only what cross-module
 * consumers call.
 *
 * This file imports no `@modules/*` code: the exposure type comes from the
 * neutral `shared/contracts/types` layer.
 */
import type { TeamClusterServiceExposure } from '@shared/contracts/types/TeamClusterExposure';

export interface ITeamClusterExposureRegistryService {
    listTeamClusterExposures(teamClusterId: string): TeamClusterServiceExposure[];
}
