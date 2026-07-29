export const JOB_STATUS_KEY_PREFIX = 'jobs:status:';
const JOB_TOMBSTONE_KEY_PREFIX = 'jobs:removed:';

export const jobStatusKey = (jobId: string): string => `${JOB_STATUS_KEY_PREFIX}${jobId}`;

export const jobTombstoneKey = (jobId: string): string => `${JOB_TOMBSTONE_KEY_PREFIX}${jobId}`;

export const projectedTeamJobsKey = (teamId: string): string => `team:${teamId}:projected-jobs`;

export const projectedTeamJobsRevisionKey = (teamId: string): string => `team:${teamId}:projected-jobs:revision`;

export const projectedAnalysisJobsKey = (analysisId: string): string => `analysis:${analysisId}:projected-jobs`;
