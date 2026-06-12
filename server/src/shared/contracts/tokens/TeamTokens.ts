/**
 * Neutral, cross-module DI token symbols for the TEAM kernel module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * keys are the SAME `Symbol.for(...)` instances used by the owner module's
 * `TEAM_TOKENS`, so registration and resolution are byte-identical at runtime.
 * Hosting them here lets a consumer inject team-owned services (repositories,
 * default-team enrollment) without importing `@modules/team`.
 */
export const TEAM_CONTRACT_TOKENS = Object.freeze({
    TeamRepository: Symbol.for('TeamRepository'),
    TeamMemberRepository: Symbol.for('TeamMemberRepository'),
    DefaultTeamEnroller: Symbol.for('DefaultTeamEnroller'),
    SecretKeyRepository: Symbol.for('SecretKeyRepository'),
    SecretKeyUsageLogRepository: Symbol.for('SecretKeyUsageLogRepository')
});
