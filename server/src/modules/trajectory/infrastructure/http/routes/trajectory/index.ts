import { Resource } from '@core/constants/resources';
import { trajectoryValidation } from '@modules/trajectory/infrastructure/http/validation/trajectory';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import controllers from '@modules/trajectory/infrastructure/http/controllers/trajectory';
import { createHttpModule } from '@shared/infrastructure/http/routing/create-http-module';
import { RATE_LIMIT_POLICIES } from '@shared/infrastructure/http/routing/rate-limit-policies';

export default createHttpModule({
    basePath: '/api/trajectories/:teamId',
    resource: Resource.TRAJECTORY,
    routes: (router) => {
        router.get('/samples', controllers.listSamples.handle);
        router.get('/samples/:filename', controllers.downloadSamples.handle);
        router.route('/')
            .post(RATE_LIMIT_POLICIES.trajectoryUpload, upload.array('trajectoryFiles'), controllers.create.handle)
            .get(trajectoryValidation.listByTeamId, controllers.getByTeamId.handle);
        router.get('/metrics', trajectoryValidation.getMetrics, controllers.getMetrics.handle);
        router.get('/:trajectoryId/preview', trajectoryValidation.getPreview, controllers.getPreview.handle);
        router.get('/:trajectoryId/download', trajectoryValidation.downloadTrajectory, controllers.downloadTrajectory.handle);
        router.get('/:trajectoryId/atoms', trajectoryValidation.getAtoms, controllers.getAtoms.handle);
        router.get('/:trajectoryId/atoms/:analysisId', trajectoryValidation.getAtomsByAnalysis, controllers.getAtoms.handle);
        router.get('/:trajectoryId/scene-artifacts', trajectoryValidation.getSceneArtifacts, controllers.getSceneArtifacts.handle);
        router.get('/:trajectoryId/glb/:timestep/:analysisId', trajectoryValidation.getGLB, controllers.getGLB.handle);
        router.route('/:trajectoryId')
            .get(trajectoryValidation.getById, controllers.getById.handle)
            .patch(trajectoryValidation.update, controllers.updateById.handle)
            .delete(controllers.deleteById.handle);
    }
});
