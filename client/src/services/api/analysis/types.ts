export interface AnalysisConfig {
    _id: string;
    name: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: string;
    [key: string]: any;
}

export interface GetAnalysisConfigsResponse {
    configs: AnalysisConfig[];
    total: number;
    page: number;
    limit: number;
}
