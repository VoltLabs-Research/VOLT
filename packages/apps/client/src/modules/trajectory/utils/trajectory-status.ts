const PROCESSING_STAGE_LABELS: Record<string, string> = {
    idle: '',
    'waiting-for-process': 'Waiting...',
    queued: 'Queued...',
    processing: 'Processing frames...',
    completed: 'Complete',
    failed: 'Failed'
};

export const getStageMessage = (stage: string | undefined): string => {
    if (!stage) return '';
    return PROCESSING_STAGE_LABELS[stage] ?? 'Processing...';
};

export const isProcessingStatus = (status: string | undefined): boolean => {
    return !!status && status !== 'completed' && status !== 'idle' && status !== 'failed';
};

export const isTrajectoryCompleted = (status: string | undefined): boolean => {
    return status === 'completed';
};

export const isTrajectoryNavigable = (status: string | undefined): boolean => {
    return isTrajectoryCompleted(status);
};
