export interface ExecutePluginInputDTO {
    pluginId: string;
    trajectoryId: string;
    teamClusterId: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    timestep?: number;
};

export interface ExecutePluginOutputDTO {
    analysisId: string;
};
