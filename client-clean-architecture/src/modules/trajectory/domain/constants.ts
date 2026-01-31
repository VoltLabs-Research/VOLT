import type { TrajectoryStatus } from './entities/Trajectory';

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
    idle: '',
    waiting_for_proccess: 'Waiting...',
    queued: 'Queued...',
    analyzing: 'Analyzing...',
    processing: 'Processing frames...',
    rendering: 'Rendering...',
    completed: 'Complete',
    failed: 'Failed'
};

export const PROGRESS_STAGE_LABELS: Record<string, string> = {
    parsing: 'Parsing Files',
    processing: 'Processing Frames',
    uploading: 'Uploading to Cloud',
    rasterizing: 'Generating Previews',
    completed: 'Completed',
    failed: 'Failed'
};

export const getStageMessage = (stage: TrajectoryStatus | string | undefined): string => {
    if(!stage) return '';
    return PROCESSING_STAGE_LABELS[stage] ?? 'Processing...';
};

export const getProgressStageLabel = (stage: string | undefined): string => {
    if(!stage) return '';
    return PROGRESS_STAGE_LABELS[stage] ?? stage.toUpperCase();
};

export const isProcessingStatus = (status: TrajectoryStatus | string | undefined): boolean => {
    return !!status && status !== 'completed' && status !== 'idle';
};
