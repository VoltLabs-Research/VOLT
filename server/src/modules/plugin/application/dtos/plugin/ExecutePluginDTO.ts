export interface ExecutePluginInputDTO {
    pluginId: string;
    trajectoryId: string;
    userId: string;
    teamId: string;
    teamClusterId?: string;
    selectedFrameOnly?: boolean;
    selectedTimesteps?: number[];
    config: Record<string, unknown>;
    timestep?: number;
};
