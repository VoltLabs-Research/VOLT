export enum PluginNodeExecutionMode {
    Manual = 'manual',
    ArgumentReference = 'argumentReference'
}

export interface PluginNodeData {
    executionMode?: PluginNodeExecutionMode;
    pluginId?: string;
    argumentReference?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
    configByPluginId?: Record<string, Record<string, unknown>>;
};
