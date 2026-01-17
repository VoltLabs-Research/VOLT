export interface CreateAnalysisInputDTO {
    trajectoryId: string;
    pluginSlug: string;
    config: any;
    userId: string;
    teamId: string;
}

export interface CreateAnalysisOutputDTO {
    analysis: {
        id: string;
        trajectory: string;
        plugin: string;
        config: any;
        status: string;
        createdAt: Date;
    };
}
