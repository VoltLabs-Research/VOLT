export enum PluginNodeExecutionMode {
    Manual = 'manual',
    ArgumentReference = 'argumentReference'
}

export enum PluginNodeOutputPathMode {
    Isolated = 'isolated',
    Parent = 'parent'
}

export interface PluginNodeData {
    executionMode?: PluginNodeExecutionMode;
    outputPathMode?: PluginNodeOutputPathMode;
    pluginId?: string;
    argumentReference?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
    configByPluginId?: Record<string, Record<string, unknown>>;
};
