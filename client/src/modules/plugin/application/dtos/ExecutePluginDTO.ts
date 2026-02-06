export interface ExecutePluginInputDTO {
    pluginSlug: string;
    trajectoryId: string;
    config: Record<string, unknown>;
    selectedFrameOnly?: boolean;
    timestep?: number;
};

export interface ExecutePluginOutputDTO {
    analysisId: string;
};
