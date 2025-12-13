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
