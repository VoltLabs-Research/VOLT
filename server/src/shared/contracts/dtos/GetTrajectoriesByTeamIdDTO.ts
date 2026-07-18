/**
 * Neutral cross-module contract for the persisted trajectory "row" view.
 *
 * STANDALONE neutral copy of the shape owned by
 * `@modules/trajectory/dtos/trajectory/GetTrajectoriesByTeamIdDTO`
 * (`TrajectoryPersistedDTO`). The trajectory module source is off-limits to this
 * migration, so cross-module consumers (dashboard global search) depend on this
 * neutral version instead of importing the trajectory module.
 *
 * Built on the neutral `TrajectoryProps` structural contract
 * (`@shared/contracts/types/Trajectory`) plus the persisted `_id`. The `status`
 * field is widened to `string`: the owner's `TrajectoryProps.status` is the
 * `TrajectoryStatus` string enum, and string enums are NOMINAL in TypeScript, so
 * a neutral enum-typed field would reject values produced under the module's own
 * (distinct) enum declaration. Widening keeps the contract neutral and
 * assignable from module-typed data without changing any runtime value.
 *
 * Pure data/types only — no `@modules/*` imports.
 */
import type { TrajectoryProps } from '@shared/contracts/types/Trajectory';

export interface TrajectoryPersistedDTO extends Omit<TrajectoryProps, 'status'> {
    _id: string;
    status: string;
}
