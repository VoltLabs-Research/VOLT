import { Router } from 'express';
import PluginsController from '@/controllers/plugins';
import * as authMiddleware from '@/middlewares/authentication';
import * as trajMiddleware from '@/middlewares/trajectory';
import * as pluginMiddleware from '@/middlewares/plugins';
import { Action } from '@/constants/permissions';
import RBACMiddleware from '@/middlewares/rbac';

const router = Router();
const controller = new PluginsController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ)
    .route('/', controller.getAll)
    .route('/schemas', controller.getNodeSchemas)
    .route('/listing/:pluginSlug/:listingSlug', controller.getPluginListingDocuments)
    .route('/:id', controller.getOne)
    .route('/:pluginSlug/analysis/:analysisId/export-results', controller.exportAnalysisResults)
    .route('/:id/export', controller.exportPlugin);

rbac.groupBy(Action.UPDATE)
    .route('/:id', controller.updateOne)
    .route('/validate', controller.validateWorkflow)
    .route('/:id/binary', pluginMiddleware.loadPlugin, controller.uploadBinaryMiddleware, controller.uploadBinary);

rbac.groupBy(Action.CREATE)
    .route('/', controller.createOne)
    .route('/import', controller.importPluginMiddleware, controller.importPlugin);

rbac.groupBy(Action.DELETE)
    .route('/:id', controller.deleteOne)
    .route('/:id/binary', pluginMiddleware.loadPlugin, controller.deleteBinary);

rbac.groupBy(Action.READ, trajMiddleware.checkTeamMembershipForTrajectory)
    .route('/glb/:id/:analysisId/:exposureId/:timestep', controller.getPluginExposureGLB)
    .route('/chart/:id/:analysisId/:exposureId/:timestep', controller.getPluginExposureChart)
    .route('/file/:id/:analysisId/:exposureId/:timestep/:filename', controller.getPluginExposureFile)
    .route('/listing/:pluginSlug/:listingSlug/:id', controller.getPluginListingDocuments)
    .route('/per-frame-listing/:id/:analysisId/:exposureId/:timestep', controller.getPerFrameListing);

rbac.groupBy(Action.CREATE, trajMiddleware.checkTeamMembershipForTrajectory)
    .route('/:pluginSlug/trajectory/:id/execute', controller.evaluatePlugin);

export default router;