export interface PluginNodeData {
    pluginId?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
};
