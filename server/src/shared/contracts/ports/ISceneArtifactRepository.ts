/**
 * Canonical, neutral repository-port contract for the SceneArtifact domain.
 * Extracted from
 * `@modules/trajectory/domain/port/scene-artifacts/ISceneArtifactRepository`
 * during the detachable-modules migration. The original owner file re-exports
 * every name below so existing importers compile unchanged.
 *
 * PHASE-2 FOLLOW-UP (type-only recoupling): the entity `SceneArtifact` is a
 * class with methods and `SceneArtifactProps` references the runtime
 * `SceneArtifactSourceType` / `SceneArtifactStatus` enums, so neither can be
 * moved into this pure-type contracts layer without dragging runtime in. They
 * are imported here with `import type` only (erased by tsc), but this still
 * physically recouples the contract to the trajectory module at file-removal
 * time. Decoupling these is deferred.
 */
import type { IBaseRepository, PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type SceneArtifact from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';

export interface TeamSceneArtifactFilters {
    sourceType?: SceneArtifactProps['sourceType'];
    analysisId?: string;
    timestep?: number;
}

export interface ISceneArtifactRepository extends IBaseRepository<SceneArtifact, SceneArtifactProps> {
    upsertByObjectName(objectName: string, data: Partial<SceneArtifactProps>): Promise<SceneArtifact>;
    upsertManyByObjectName(entries: Array<{ objectName: string; data: Partial<SceneArtifactProps> }>): Promise<void>;
    findAllByTeamId(
        teamId: string,
        options: PaginationOptions,
        filters?: TeamSceneArtifactFilters
    ): Promise<PaginatedResult<SceneArtifact>>;
}
