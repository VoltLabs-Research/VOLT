export interface CreatePluginInputDTO {
    workflow: any;
    teamId: string;
    slug?: string;
}

export interface CreatePluginOutputDTO {
    plugin: any;
}
