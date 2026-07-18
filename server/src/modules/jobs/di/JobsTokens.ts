import { COMPUTE_TOKENS } from '@shared/contracts/tokens/ComputeTokens';

export const JOBS_TOKENS = Object.freeze({
    TeamJobMaintenanceService: COMPUTE_TOKENS.TeamJobMaintenanceService,
    TeamJobProjectionService: Symbol.for('TeamJobProjectionService'),
    JobsService: Symbol.for('JobsService')
});
