/**
 * Canonical, neutral definition of the `JobStatus` lifecycle enum.
 *
 * Extracted from `@modules/jobs/domain/entities/Job` during the
 * detachable-modules migration. Although the `shared/contracts` layer is
 * type-only by convention, this enum is intentionally a runtime VALUE: several
 * consumer modules (cluster, trajectory, team) use it in `===` comparisons and
 * type-guards. It is pure data with no `@modules/*` coupling, so hosting the
 * `export enum` here is allowed. The original owner file re-exports it, so
 * existing importers compile and behave unchanged.
 */
export enum JobStatus {
    Queued = 'queued',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Retrying = 'retrying'
}
