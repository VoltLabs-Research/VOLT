export const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const JOB_TOMBSTONE_KEY_PREFIX = 'jobs:removed:';

export const jobStatusKey = (jobId: string): string => `${JOB_STATUS_KEY_PREFIX}${jobId}`;

export const jobTombstoneKey = (jobId: string): string => `${JOB_TOMBSTONE_KEY_PREFIX}${jobId}`;

export const projectedTeamJobsKey = (teamId: string): string => `team:${teamId}:projected-jobs`;

export const projectedTeamJobsRevisionKey = (teamId: string): string => `team:${teamId}:projected-jobs:revision`;

export const projectedAnalysisJobsKey = (analysisId: string): string => `analysis:${analysisId}:projected-jobs`;

export const analysisRemainingKey = (analysisId: string): string => `daemon-analysis:${analysisId}:remaining`;

export const analysisFailedKey = (analysisId: string): string => `daemon-analysis:${analysisId}:failed`;

export const analysisTerminalReceiptKey = (analysisId: string, jobId: string): string => `daemon-analysis:${analysisId}:terminal:${jobId}`;

export const analysisTerminalReceiptSetKey = (analysisId: string): string => `daemon-analysis:${analysisId}:terminal-keys`;

export const glbTerminalReceiptKey = (trajectoryId: string, jobId: string): string => `daemon-glb:${trajectoryId}:terminal:${jobId}`;

export const glbTerminalReceiptSetKey = (trajectoryId: string): string => `daemon-glb:${trajectoryId}:terminal-keys`;

export const glbRemainingKey = (trajectoryId: string): string => `daemon-glb:${trajectoryId}:remaining`;

export const glbFailedKey = (trajectoryId: string): string => `daemon-glb:${trajectoryId}:failed`;

export const canvasWorkspaceKey = (trajectoryId: string, ownerId: string): string => `canvas:workspace:${trajectoryId}:${ownerId}`;

export const canvasWorkspaceIndexKey = (trajectoryId: string): string => `canvas:workspace:index:${trajectoryId}`;

export const jupyterTrajectoryLockKey = (teamId: string, trajectoryId: string): string => `lock:jupyter:${teamId}:trajectory:${trajectoryId}`;
