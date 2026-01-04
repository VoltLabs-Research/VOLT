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
import AnalysisConfigController from '@/controllers/analysis-config';
import * as middleware from '@/middlewares/analysis-config';
import * as authMiddleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new AnalysisConfigController();
const rbac = new RBACMiddleware(controller, router);

rbac.groupBy(Action.READ, authMiddleware.protect)
    .route('/', controller.getAll);

rbac.groupBy(Action.READ, authMiddleware.optionalAuth, middleware.checkTeamMembership)
    .route('/:id', controller.getOne);

rbac.groupBy(Action.DELETE, authMiddleware.protect)
    .route('/:id', controller.deleteOne);

rbac.groupBy(Action.UPDATE, authMiddleware.protect)
    .route('/:id/retry-failed-frames', controller.retryFailedFrames);

export default router;