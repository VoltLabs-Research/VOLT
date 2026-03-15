interface JobsTokens {
    readonly TeamJobMaintenanceService: symbol;
}

export const JOBS_TOKENS: JobsTokens = {
    TeamJobMaintenanceService: Symbol.for('TeamJobMaintenanceService')
};
