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
import ApiTokenController from '@/controllers/api-tokens';
import * as middleware from '@/middlewares/authentication';
import * as apiTokenMiddleware from '@/middlewares/api-token';

const router = Router();
const controller = new ApiTokenController();

// Valid permissions for validation
const validPermissions = [
    'read:trajectories',
    'write:trajectories',
    'delete:trajectories',
    'read:analysis',
    'write:analysis',
    'delete:analysis',
    'read:teams',
    'write:teams',
    'admin:all'
];

router.use(middleware.protect);

router.route('/')
    .get(controller.getMyApiTokens)
    .post(
        apiTokenMiddleware.validateApiTokenPermissionsInBody(validPermissions),
        controller.createApiToken
    );

router.route('/stats')
    .get(controller.getApiTokenStats);

router.route('/:id')
    .get(
        apiTokenMiddleware.loadAndVerifyApiTokenOwnership,
        controller.getApiToken
    )
        .patch(
        apiTokenMiddleware.loadAndVerifyApiTokenOwnership,
        apiTokenMiddleware.validateApiTokenPermissionsInBody(validPermissions),
        controller.updateApiToken
    )
        .delete(
        apiTokenMiddleware.loadAndVerifyApiTokenOwnership,
        controller.deleteApiToken
    );

router.route('/:id/regenerate')
    .post(
        apiTokenMiddleware.loadAndVerifyApiTokenOwnership,
        controller.regenerateApiToken
    );

export default router;
