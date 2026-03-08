export interface CreateAnalysisInputDTO {
    trajectoryId: string;
    pluginId: string;
    config: any;
    userId: string;
    teamId: string;
}

export interface CreateAnalysisOutputDTO {
    analysis: {
        _id: string;
        trajectory: string;
        plugin: string;
        config: any;
        status: string;
        createdAt: Date;
    };
}
