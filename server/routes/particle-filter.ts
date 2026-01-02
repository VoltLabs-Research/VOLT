/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 */

import { Router } from 'express';
import ParticleFilterController from '@/controllers/particle-filter';
import * as middleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new ParticleFilterController();
const rbac = new RBACMiddleware(controller, router);

router.use(middleware.protect);

rbac.groupBy(Action.READ, middleware.protect)
    .route('/properties/:trajectoryId/:analysisId', controller.getProperties)
    .route('/preview/:trajectoryId/:analysisId', controller.preview)
    .route('/:trajectoryId/:analysisId', controller.get);

rbac.groupBy(Action.CREATE, middleware.protect)
    .route('/:trajectoryId/:analysisId', controller.applyAction);

export default router;
