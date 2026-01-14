export interface ExecutePluginInputDTO{
    pluginSlug: string;
    trajectoryId: string;
    userId: string;
    teamId: string;
    selectedFrameOnly?: boolean;
    config: Record<string, any>;
    timestep?: number;
};