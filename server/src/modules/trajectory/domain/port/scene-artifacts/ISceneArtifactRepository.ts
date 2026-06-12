/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/ISceneArtifactRepository`) for the
 * detachable-modules migration. Re-exported here so existing importers of this
 * module path keep compiling unchanged.
 */
export type {
    ISceneArtifactRepository,
    TeamSceneArtifactFilters
} from '@shared/contracts/ports/ISceneArtifactRepository';
