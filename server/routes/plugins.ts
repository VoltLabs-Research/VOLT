import { Router } from 'express';
import PluginsController from '@/controllers/plugins';
import * as authMiddleware from '@/middlewares/authentication';
import * as trajMiddleware from '@/middlewares/trajectory';

const router = Router();
const controller = new PluginsController();

router.use(authMiddleware.protect);

router.get('/', controller.getAll);
router.get('/published', controller.getPublishedPlugins);
router.get('/schemas', controller.getNodeSchemas);
router.post('/validate', controller.validateWorkflow);
router.post('/', controller.createOne);
router.get('/:id', controller.getOne);
router.put('/:id', controller.updateOne);
router.delete('/:id', controller.deleteOne);
router.post('/:id/publish', controller.publishPlugin);
router.post('/:id/binary', controller.uploadBinaryMiddleware, controller.uploadBinary);
router.delete('/:id/binary', controller.deleteBinary);

router.post(
    '/:pluginSlug/modifier/:modifierSlug/trajectory/:id',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controller.evaluatePlugin
);

router.get(
    '/glb/:id/:analysisId/:exposureId/:timestep',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controller.getPluginExposureGLB
);

router.get(
    '/file/:id/:analysisId/:exposureId/:timestep/:filename',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controller.getPluginExposureFile
);

router.get(
    '/listing/:pluginSlug/:listingSlug/:id',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controller.getPluginListingDocuments
);

router.get(
    '/per-frame-listing/:id/:analysisId/:exposureId/:timestep',
    trajMiddleware.checkTeamMembershipForTrajectory,
    controller.getPerFrameListing
);

export default router;