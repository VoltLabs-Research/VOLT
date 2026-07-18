
export interface ITeamClusterSelectionService {
    resolveConnectedClusterId(teamId: string, requestedTeamClusterId?: string): Promise<string>;
    resolveComputeClusterId(teamId: string, requestedTeamClusterId?: string, preferredStorageClusterId?: string): Promise<string>;
    resolveStorageClusterId(teamId: string, requestedTeamClusterId?: string, preferredComputeClusterId?: string): Promise<string>;
}
