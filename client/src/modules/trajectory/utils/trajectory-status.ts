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

/*
 * Navigability happens to coincide with completion today, but they are different
 * questions — one is about the UI, the other about the data. Kept as its own name so a
 * future rule ("navigable while frames are still rasterising") has somewhere to go.
 */
export const isTrajectoryNavigable = (status: string | undefined): boolean => {
    return isTrajectoryCompleted(status);
};
