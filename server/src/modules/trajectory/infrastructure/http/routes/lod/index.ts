import { Resource } from '@core/constants/resources';
import controllers from '@modules/trajectory/infrastructure/http/controllers/lod';
import { HttpModuleTeamScope } from '@shared/infrastructure/http/routing/HttpModule';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';

// LOD spatial-streaming REST. The octree-metadata sidecar the daemon bakes next
// to a point-cloud GLB is served here so the client LOD manager can fetch only
// visible-region tiles (the streaming that earns the 100M-atom claim). Mirrors
// the line-style ranges-sidecar route: same team scope + exposure identity.
//
// v1 serves one whole-cloud GLB with the octree as index ranges into it, so
// there is no per-cell tile-fetch route yet; it is the forward slot for when the
// daemon bakes per-cell GLB tiles.
export default createHttpModule({
    moduleKey: 'trajectory',
    basePath: '/api/lod/:teamId',
    resource: Resource.TRAJECTORY,
    teamScope: HttpModuleTeamScope.BasePath,
    routes: (router) => {
        router.get('/:trajectoryId/:analysisId/:exposureId/octree-metadata', controllers.getOctreeMetadata.handle);
    }
});
