/**
 * Canonical, neutral repository-port contract for the Trajectory domain.
 * Extracted from
 * `@modules/trajectory/domain/port/trajectory/ITrajectoryRepository` during the
 * detachable-modules migration. The original owner file re-exports it so
 * existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the entity `Trajectory` is a class
 * with methods and `TrajectoryProps` references the runtime `TrajectoryStatus`
 * enum, so neither can be moved into this pure-type contracts layer without
 * dragging runtime in. They are imported here with `import type` only (erased
 * by tsc, so no runtime/decorator coupling), but this still physically recouples
 * the contract to the trajectory module at file-removal time. Decoupling these
 * (e.g. a neutral `TrajectoryProps` + structural entity contract) is deferred.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type Trajectory from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export interface ITrajectoryRepository extends IBaseRepository<Trajectory, TrajectoryProps> {
    createWithId(id: string, data: Partial<TrajectoryProps>): Promise<Trajectory>;
    searchIdsByTeamAndName(teamId: string, search: string): Promise<string[]>;
}
