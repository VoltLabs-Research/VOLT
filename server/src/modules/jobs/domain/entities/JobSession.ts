import { v4 } from 'uuid';

export interface JobSessionData {
    sessionId: string;
    startTime: Date;
    totalJobs: number;
    teamId: string;
    status: JobSessionStatus;
    completedAt?: Date;
};

interface JobSessionCreateData {
    sessionId: string;
    teamId: string;
    totalJobs: number;
};

export enum JobSessionStatus {
    Active = 'active',
    Completed = 'completed'
}

export default class JobSession {
    constructor(public props: JobSessionData) {}

    static create(data: JobSessionCreateData): JobSession {
        return new JobSession({
            sessionId: data.sessionId,
            teamId: data.teamId,
            totalJobs: data.totalJobs,
            startTime: new Date(),
            status: JobSessionStatus.Active
        });
    }

    static generateSessionId(): string {
        return v4();
    }

    markAsCompleted(): void {
        this.props.status = JobSessionStatus.Completed;
        this.props.completedAt = new Date();
    }
};
