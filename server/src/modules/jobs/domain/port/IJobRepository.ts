export interface IJobRepository {
    removeFromTeamJobs(teamId: string, jobIds: string[]): Promise<void>;
    deleteTeamJobs(teamId: string): Promise<void>;
    getTeamJobIds(teamId: string): Promise<string[]>;
    getJobStatus(statusKey: string): Promise<Record<string, unknown> | null>;
    getJobStatuses(statusKeys: string[]): Promise<Array<Record<string, unknown> | null>>;
};
