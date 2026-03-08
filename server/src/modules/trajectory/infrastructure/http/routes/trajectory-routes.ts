import { Router } from 'express';
import { createStandardRateLimiter } from '@shared/infrastructure/http/middleware/rate-limit';
import { upload } from '@shared/infrastructure/http/middleware/upload';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';
import { Resource } from '@core/constants/resources';
import { trajectoryValidation } from '@modules/trajectory/infrastructure/http/validation/trajectory-schemas';
import controllers from '@modules/trajectory/infrastructure/http/controllers/trajectory';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/trajectory/:teamId',
    router,
    resource: Resource.TRAJECTORY
};

const uploadRateLimit = createStandardRateLimiter(5);

router.get('/samples', controllers.listSamples.handle);
router.get('/samples/:filename', controllers.downloadSamples.handle);

router.route('/')
    .post(uploadRateLimit, upload.array('trajectoryFiles'), controllers.create.handle)
    .get(trajectoryValidation.listByTeamId, controllers.getByTeamId.handle);

router.get('/metrics', trajectoryValidation.getMetrics, controllers.getMetrics.handle);
router.get('/:trajectoryId/preview', trajectoryValidation.getPreview, controllers.getPreview.handle);
router.get('/:trajectoryId/download', trajectoryValidation.downloadTrajectory, controllers.downloadTrajectory.handle);
router.get('/:trajectoryId/atoms', trajectoryValidation.getAtoms, controllers.getAtoms.handle);
router.get('/:trajectoryId/atoms/:analysisId', trajectoryValidation.getAtomsByAnalysis, controllers.getAtoms.handle);
router.get('/:trajectoryId/scene-artifacts', trajectoryValidation.getSceneArtifacts, controllers.getSceneArtifacts.handle);
router.get('/:trajectoryId/:timestep/:analysisId', trajectoryValidation.getGLB, controllers.getGLB.handle);

router.route('/:trajectoryId')
    .get(trajectoryValidation.getById, controllers.getById.handle)
    .patch(trajectoryValidation.update, controllers.updateById.handle)
    .delete(controllers.deleteById.handle);

export default module;
