export interface AnalysisConfig {
    _id: string;
    name: string;
    modifier: string;
    config: Record<string, any>;
    trajectory: string;
    [key: string]: any;
}