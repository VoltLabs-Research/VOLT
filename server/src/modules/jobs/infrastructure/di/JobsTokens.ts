interface JobsTokens {
    readonly TeamJobMaintenanceService: symbol;
    readonly TeamJobQueryService: symbol;
}

export const JOBS_TOKENS: JobsTokens = {
    TeamJobMaintenanceService: Symbol.for('TeamJobMaintenanceService'),
    TeamJobQueryService: Symbol.for('TeamJobQueryService')
};
