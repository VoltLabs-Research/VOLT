import type { TrajectoryStatus } from './trajectory';

export const PROCESSING_STAGE_LABELS: Record<string, string> = {
    idle: '',
    'waiting-for-process': 'Waiting...',
    queued: 'Queued...',
    processing: 'Processing frames...',
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

/**
 * File extensions the trajectory ingestion pipeline can actually parse.
 *
 * The ClusterDaemon parser (TrajectoryParserFactory.parseTrajectoryMetadata)
 * only recognizes LAMMPS dump files (`ITEM: TIMESTEP` -> .dump/.lammpstrj) and
 * LAMMPS data files (`N atoms` + box bounds -> .data/.lammps); anything else is
 * rejected as "Unsupported trajectory format". `.glb` is handled separately by
 * the client (TrajectoryUploaderContainer) as a local model preview.
 */
export const ACCEPTED_TRAJECTORY_EXTENSIONS = ['.dump', '.lammpstrj', '.data', '.lammps', '.glb'] as const;

export const ACCEPTED_TRAJECTORY_FILE_ACCEPT = ACCEPTED_TRAJECTORY_EXTENSIONS.join(',');

export const ACCEPTED_TRAJECTORY_FORMATS_LABEL = 'LAMMPS dump/data (.dump, .lammpstrj, .data, .lammps) or .glb';
