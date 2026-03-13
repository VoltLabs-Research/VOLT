import type { TrajectoryStatus } from './trajectory';

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
    idle: '',
    'waiting-for-process': 'Waiting...',
    queued: 'Queued...',
    analyzing: 'Analyzing...',
    processing: 'Processing frames...',
    rendering: 'Rendering...',
    completed: 'Complete',
    failed: 'Failed'
};

export const getStageMessage = (stage: TrajectoryStatus | string | undefined): string => {
    if (!stage) return '';
    return PROCESSING_STAGE_LABELS[stage] ?? 'Processing...';
};

export const isProcessingStatus = (status: TrajectoryStatus | string | undefined): boolean => {
    return !!status && status !== 'completed' && status !== 'idle' && status !== 'failed';
};
