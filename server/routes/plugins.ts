/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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
    .route('/file/:id/:analysisId/:exposureId/:timestep/:filename', controller.getPluginExposureFile)
    .route('/listing/:pluginSlug/:listingSlug/:id', controller.getPluginListingDocuments)
    .route('/per-frame-listing/:id/:analysisId/:exposureId/:timestep', controller.getPerFrameListing);

rbac.groupBy(Action.CREATE, trajMiddleware.checkTeamMembershipForTrajectory)
    .route('/:pluginSlug/trajectory/:id/execute', controller.evaluatePlugin);

export default router;