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

import express from 'express';
import ContainerController from '@/controllers/container';
import { protect } from '@/middlewares/authentication';
import * as middleware from '@/middlewares/container';

const router = express.Router();
const containerController = new ContainerController();

router.use(protect);

router.get('/', containerController.getAllContainers);
router.post(
    '/',
    middleware.verifyTeamForContainerCreation,
    containerController.createContainer
);

router.use(middleware.loadAndVerifyContainerAccess);

router.post(
    '/:id/control',
    middleware.validateContainerAction,
    containerController.controlContainer
);

router.delete('/:id', containerController.deleteContainer);
router.get('/:id/stats', containerController.getContainerStats);
router.post('/:id/restart', containerController.restartContainer);
router.patch('/:id', containerController.updateContainer);
router.get('/:id/files', containerController.getContainerFiles);
router.get('/:id/read', containerController.readContainerFile);
router.get('/:id/top', containerController.getContainerProcesses);

export default router;
export const opts = { requiresTeamId: true };