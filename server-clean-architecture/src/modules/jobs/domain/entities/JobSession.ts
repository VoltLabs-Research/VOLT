export enum JobSessionStatus{
    Active = 'active',
    Completed = 'completed'
};

export interface JobSessionData{
    sessionId: string;
    startTime: Date;
    totalJobs: number;
    teamId: string;
    status: JobSessionStatus,
    completedAt?: Date;
};

export default class JobSession{
    constructor(
        public props: JobSessionData
    ){}

    static create(data: {
        sessionId: string;
        teamId: string;
        totalJobs: number;
    }): JobSession{
        return new JobSession({
            sessionId: data.sessionId,
            teamId: data.teamId,
            totalJobs: data.totalJobs,
            startTime: new Date(),
            status: JobSessionStatus.Active
        });
    }

    static generateSessionId(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    markAsCompleted(): void{
        this.props.status = JobSessionStatus.Completed;
        this.props.completedAt = new Date();
    }
};