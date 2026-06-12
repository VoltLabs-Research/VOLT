/**
 * Neutral, cross-module query-service port for team dashboard metrics.
 * Mirrors `@modules/trajectory/domain/port/trajectory/ITeamMetricsQueryService`
 * during the detachable-modules migration so consumers (dashboard AI tool)
 * inject against a contract rather than `@modules/trajectory`.
 *
 * The concrete `TeamMetricsQueryService` is already registered under the global
 * `Symbol.for('TeamMetricsQueryService')` token (see
 * `TRAJECTORY_CONTRACT_TOKENS.TeamMetricsQueryService`), so consumers resolve
 * the same singleton without the owner module needing any change.
 *
 * Pure type — no runtime footprint, no `@modules/*` import.
 */
import type { TeamMetricsSnapshot } from '@shared/contracts/types/TeamMetrics';

export type { TeamMetricsSnapshot } from '@shared/contracts/types/TeamMetrics';

export interface ITeamMetricsQueryService {
    getTeamMetrics(teamId: string): Promise<TeamMetricsSnapshot>;
}
