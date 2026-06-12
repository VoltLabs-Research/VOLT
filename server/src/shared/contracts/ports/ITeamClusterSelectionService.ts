/**
 * Neutral cross-module port for team-cluster selection (which cluster a piece of
 * work runs/stores on). Owned conceptually by the container module; consumed by
 * trajectory, plugin, raster, whiteboards. Canonical home in `shared/contracts`
 * so those modules don't import `@modules/container`. The concrete service stays
 * in the container module, registered against its DI token.
 */
export interface ITeamClusterSelectionService {
    resolveTeamClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string>;
    resolveConnectedClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string>;
    resolveComputeClusterId(teamId: string, requestedTeamClusterId?: string, preferredStorageClusterId?: string): Promise<string>;
    resolveStorageClusterId(teamId: string, requestedTeamClusterId?: string, preferredComputeClusterId?: string): Promise<string>;
}
