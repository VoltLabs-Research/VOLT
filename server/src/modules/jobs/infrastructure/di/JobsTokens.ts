interface JobsTokens {
    readonly JobRepository: symbol;
    readonly QueueRegistry: symbol;
    readonly TeamJobMaintenanceService: symbol;
}

export const JOBS_TOKENS: JobsTokens = {
    JobRepository: Symbol.for('JobRepository'),
    QueueRegistry: Symbol.for('QueueRegistry'),
    TeamJobMaintenanceService: Symbol.for('TeamJobMaintenanceService')
};
