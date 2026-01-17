export interface UpdateAnalysisInputDTO {
    id: string;
    config?: any;
}

export interface UpdateAnalysisOutputDTO {
    analysis: {
        id: string;
        config: any;
        updatedAt: Date;
    };
}
