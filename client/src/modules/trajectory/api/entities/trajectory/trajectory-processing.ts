export interface TrajectoryProcessingProgress {
    stage: 'parsing' | 'processing' | 'uploading' | 'rasterizing' | 'completed' | 'failed';
    step: number;
    totalSteps: number;
    percentage: number;
    message?: string;
}
